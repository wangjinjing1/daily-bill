import { hashPassword } from "./auth.js";
import { BillType, User } from "./models.js";

export async function ensureSuperAdmin(username: string, password: string) {
  const existing = await User.findOne({ where: { username } });
  const passwordHash = await hashPassword(password);

  if (!existing) {
    const user = await User.create({
      username,
      passwordHash,
      role: "SUPER_ADMIN",
      status: "ENABLED"
    });

    await BillType.bulkCreate([
      { userId: user.id, name: "餐饮", sortOrder: 1, enabled: true },
      { userId: user.id, name: "交通", sortOrder: 2, enabled: true },
      { userId: user.id, name: "日用", sortOrder: 3, enabled: true }
    ]);
    return;
  }

  await existing.update({
    passwordHash,
    role: "SUPER_ADMIN",
    status: "ENABLED"
  });
}
