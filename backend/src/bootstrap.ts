import { DataTypes } from "sequelize";
import { hashPassword } from "./auth.js";
import { sequelize } from "./db.js";
import { BillType, User } from "./models.js";

export async function ensureUserExportRangeColumns() {
  const queryInterface = sequelize.getQueryInterface();
  const table = await queryInterface.describeTable("users");

  if (!("exportStartDate" in table)) {
    await queryInterface.addColumn("users", "exportStartDate", {
      type: DataTypes.DATEONLY,
      allowNull: true
    });
  }

  if (!("exportEndDate" in table)) {
    await queryInterface.addColumn("users", "exportEndDate", {
      type: DataTypes.DATEONLY,
      allowNull: true
    });
  }

  if (!("exportCycleDay" in table)) {
    await queryInterface.addColumn("users", "exportCycleDay", {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true
    });
  }
}

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
      { userId: user.id, name: "饮食", sortOrder: 1, enabled: true },
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
