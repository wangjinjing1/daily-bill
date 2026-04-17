import cors from "cors";
import express from "express";
import { Op } from "sequelize";
import { comparePassword, hashPassword, signToken, verifyToken } from "./auth.js";
import { config } from "./config.js";
import { buildSummaryWorkbook, buildTransactionWorkbook } from "./export.js";
import { BillEntry, BillType, User } from "./models.js";
import { assertAmount, assertDate, assertRangeWithinMonth } from "./utils.js";

export const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json());

type RequestUser = {
  id: number;
  username: string;
  role: "SUPER_ADMIN" | "USER";
};

function asyncHandler(handler: express.Handler): express.Handler {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
}

function getToken(req: express.Request) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return null;
  }
  return authHeader.slice(7);
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ message: "未登录或 token 缺失" });
    return;
  }

  try {
    const payload = verifyToken(token);
    (req as express.Request & { user: RequestUser }).user = {
      id: payload.userId,
      username: payload.username,
      role: payload.role
    };
    next();
  } catch {
    res.status(401).json({ message: "登录状态已失效" });
  }
}

function requireSuperAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const user = (req as express.Request & { user: RequestUser }).user;
  if (user.role !== "SUPER_ADMIN") {
    res.status(403).json({ message: "只有超级管理员可执行该操作" });
    return;
  }
  next();
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

app.post(
  "/api/auth/login",
  asyncHandler(async (req, res) => {
    const { username, password } = req.body ?? {};
    if (!username || !password) {
      res.status(400).json({ message: "请输入用户名和密码" });
      return;
    }

    const user = await User.findOne({ where: { username } });
    if (!user || !(await comparePassword(password, user.passwordHash))) {
      res.status(400).json({ message: "用户名或密码错误" });
      return;
    }
    if (user.status !== "ENABLED") {
      res.status(403).json({ message: "账号已被禁用" });
      return;
    }

    res.json({
      token: signToken(user),
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  })
);

app.get(
  "/api/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = (req as express.Request & { user: RequestUser }).user;
    const user = await User.findByPk(currentUser.id);
    if (!user) {
      res.status(404).json({ message: "用户不存在" });
      return;
    }
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status
    });
  })
);

app.post(
  "/api/me/change-password",
  requireAuth,
  asyncHandler(async (req, res) => {
    const currentUser = (req as express.Request & { user: RequestUser }).user;
    const oldPassword = String(req.body?.oldPassword ?? "");
    const newPassword = String(req.body?.newPassword ?? "");

    if (!oldPassword || !newPassword) {
      res.status(400).json({ message: "请输入原密码和新密码" });
      return;
    }

    if (newPassword.length < 6) {
      res.status(400).json({ message: "新密码至少 6 位" });
      return;
    }

    const user = await User.findByPk(currentUser.id);
    if (!user) {
      res.status(404).json({ message: "用户不存在" });
      return;
    }

    const matched = await comparePassword(oldPassword, user.passwordHash);
    if (!matched) {
      res.status(400).json({ message: "原密码错误" });
      return;
    }

    await user.update({
      passwordHash: await hashPassword(newPassword)
    });

    res.json({ success: true });
  })
);

app.get(
  "/api/types",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { user: RequestUser }).user;
    const types = await BillType.findAll({
      where: { userId: user.id },
      order: [["sortOrder", "ASC"], ["id", "ASC"]]
    });
    res.json(types);
  })
);

app.post(
  "/api/types",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { user: RequestUser }).user;
    const name = String(req.body?.name ?? "").trim();
    const sortOrder = Number(req.body?.sortOrder ?? 0);
    if (!name) {
      res.status(400).json({ message: "请输入记账类型名称" });
      return;
    }

    const type = await BillType.create({
      userId: user.id,
      name,
      sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
      enabled: req.body?.enabled !== false
    });
    res.status(201).json(type);
  })
);

app.put(
  "/api/types/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { user: RequestUser }).user;
    const type = await BillType.findOne({ where: { id: req.params.id, userId: user.id } });
    if (!type) {
      res.status(404).json({ message: "记账类型不存在" });
      return;
    }

    const name = String(req.body?.name ?? "").trim();
    if (!name) {
      res.status(400).json({ message: "请输入记账类型名称" });
      return;
    }

    await type.update({
      name,
      sortOrder: Number(req.body?.sortOrder ?? type.sortOrder),
      enabled: req.body?.enabled ?? type.enabled
    });
    res.json(type);
  })
);

app.delete(
  "/api/types/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { user: RequestUser }).user;
    const type = await BillType.findOne({ where: { id: req.params.id, userId: user.id } });
    if (!type) {
      res.status(404).json({ message: "记账类型不存在" });
      return;
    }

    const entryCount = await BillEntry.count({ where: { billTypeId: type.id, userId: user.id } });
    if (entryCount > 0) {
      res.status(400).json({ message: "该类型已有关联流水，不能删除" });
      return;
    }

    await type.destroy();
    res.json({ success: true });
  })
);

app.get(
  "/api/bills",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { user: RequestUser }).user;
    const page = Math.max(Number(req.query.page ?? 1), 1);
    const pageSize = Math.min(Math.max(Number(req.query.pageSize ?? 10), 1), 100);
    const typeId = req.query.typeId ? Number(req.query.typeId) : undefined;
    const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
    const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
    const where: Record<string, unknown> = { userId: user.id };
    if (typeId) {
      where.billTypeId = typeId;
    }
    if (startDate && endDate) {
      where.occurredOn = {
        [Op.between]: [assertDate(startDate), assertDate(endDate)]
      };
    } else if (startDate) {
      where.occurredOn = {
        [Op.gte]: assertDate(startDate)
      };
    } else if (endDate) {
      where.occurredOn = {
        [Op.lte]: assertDate(endDate)
      };
    }

    const { rows, count } = await BillEntry.findAndCountAll({
      where,
      include: [{ model: BillType, as: "billType" }],
      order: [["occurredOn", "DESC"], ["id", "DESC"]],
      offset: (page - 1) * pageSize,
      limit: pageSize
    });

    res.json({
      items: rows,
      total: count,
      page,
      pageSize
    });
  })
);

app.post(
  "/api/bills",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { user: RequestUser }).user;
    const occurredOn = assertDate(req.body?.occurredOn);
    const amount = assertAmount(req.body?.amount);
    const billTypeId = Number(req.body?.billTypeId);
    const note = String(req.body?.note ?? "").trim();

    const type = await BillType.findOne({ where: { id: billTypeId, userId: user.id, enabled: true } });
    if (!type) {
      res.status(400).json({ message: "记账类型不存在或已禁用" });
      return;
    }

    const entry = await BillEntry.create({
      userId: user.id,
      billTypeId,
      occurredOn,
      amount,
      note: note || null
    });

    const created = await BillEntry.findByPk(entry.id, {
      include: [{ model: BillType, as: "billType" }]
    });
    res.status(201).json(created);
  })
);

app.put(
  "/api/bills/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { user: RequestUser }).user;
    const entry = await BillEntry.findOne({ where: { id: req.params.id, userId: user.id } });
    if (!entry) {
      res.status(404).json({ message: "账单不存在" });
      return;
    }

    const occurredOn = assertDate(req.body?.occurredOn);
    const amount = assertAmount(req.body?.amount);
    const billTypeId = Number(req.body?.billTypeId);
    const note = String(req.body?.note ?? "").trim();

    const type = await BillType.findOne({ where: { id: billTypeId, userId: user.id, enabled: true } });
    if (!type) {
      res.status(400).json({ message: "记账类型不存在或已禁用" });
      return;
    }

    await entry.update({
      occurredOn,
      amount,
      billTypeId,
      note: note || null
    });

    const updated = await BillEntry.findByPk(entry.id, {
      include: [{ model: BillType, as: "billType" }]
    });
    res.json(updated);
  })
);

app.delete(
  "/api/bills/:id",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { user: RequestUser }).user;
    const entry = await BillEntry.findOne({ where: { id: req.params.id, userId: user.id } });
    if (!entry) {
      res.status(404).json({ message: "账单不存在" });
      return;
    }

    await entry.destroy();
    res.json({ success: true });
  })
);

app.get(
  "/api/bills/export/transactions",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { user: RequestUser }).user;
    const { start, end } = assertRangeWithinMonth(
      req.query.startDate as string | undefined,
      req.query.endDate as string | undefined
    );

    const entries = await BillEntry.findAll({
      where: {
        userId: user.id,
        occurredOn: { [Op.between]: [start, end] }
      },
      include: [{ model: BillType, as: "billType" }],
      order: [["occurredOn", "ASC"], ["id", "ASC"]]
    });

    const buffer = await buildTransactionWorkbook(entries as Array<BillEntry & { billType?: BillType }>);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="transactions-${start}-${end}.xlsx"`);
    res.send(Buffer.from(buffer));
  })
);

app.get(
  "/api/bills/export/summary",
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = (req as express.Request & { user: RequestUser }).user;
    const { start, end } = assertRangeWithinMonth(
      req.query.startDate as string | undefined,
      req.query.endDate as string | undefined
    );

    const entries = await BillEntry.findAll({
      where: {
        userId: user.id,
        occurredOn: { [Op.between]: [start, end] }
      },
      include: [{ model: BillType, as: "billType" }],
      order: [["occurredOn", "ASC"], ["id", "ASC"]]
    });

    const buffer = await buildSummaryWorkbook(entries as Array<BillEntry & { billType?: BillType }>);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="summary-${start}-${end}.xlsx"`);
    res.send(Buffer.from(buffer));
  })
);

app.get(
  "/api/users",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (_req, res) => {
    const users = await User.findAll({
      attributes: ["id", "username", "role", "status", "createdAt", "updatedAt"],
      order: [["id", "ASC"]]
    });
    res.json(users);
  })
);

app.post(
  "/api/users",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const username = String(req.body?.username ?? "").trim();
    const password = String(req.body?.password ?? "").trim();
    const role = req.body?.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER";

    if (!username || !password) {
      res.status(400).json({ message: "用户名和密码不能为空" });
      return;
    }

    const user = await User.create({
      username,
      passwordHash: await hashPassword(password),
      role,
      status: "ENABLED"
    });

    await BillType.bulkCreate([
      { userId: user.id, name: "餐饮", sortOrder: 1, enabled: true },
      { userId: user.id, name: "交通", sortOrder: 2, enabled: true },
      { userId: user.id, name: "日用", sortOrder: 3, enabled: true }
    ]);

    res.status(201).json({
      id: user.id,
      username: user.username,
      role: user.role,
      status: user.status
    });
  })
);

app.put(
  "/api/users/:id",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const target = await User.findByPk(Number(req.params.id));
    if (!target) {
      res.status(404).json({ message: "用户不存在" });
      return;
    }

    await target.update({
      role: req.body?.role === "SUPER_ADMIN" ? "SUPER_ADMIN" : "USER",
      status: req.body?.status === "DISABLED" ? "DISABLED" : "ENABLED"
    });
    res.json({
      id: target.id,
      username: target.username,
      role: target.role,
      status: target.status
    });
  })
);

app.delete(
  "/api/users/:id",
  requireAuth,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const currentUser = (req as express.Request & { user: RequestUser }).user;
    const targetId = Number(req.params.id);
    if (targetId === currentUser.id) {
      res.status(400).json({ message: "不能删除当前登录的超级管理员" });
      return;
    }
    const target = await User.findByPk(targetId);
    if (!target) {
      res.status(404).json({ message: "用户不存在" });
      return;
    }

    await BillEntry.destroy({ where: { userId: targetId } });
    await BillType.destroy({ where: { userId: targetId } });
    await target.destroy();
    res.json({ success: true });
  })
);

app.use((error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "服务器异常";
  res.status(400).json({ message });
});
