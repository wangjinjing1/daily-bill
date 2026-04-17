import { CreationOptional, DataTypes, InferAttributes, InferCreationAttributes, Model } from "sequelize";
import { sequelize } from "./db.js";

export type UserRole = "SUPER_ADMIN" | "USER";
export type UserStatus = "ENABLED" | "DISABLED";

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<number>;
  declare username: string;
  declare passwordHash: string;
  declare role: UserRole;
  declare status: UserStatus;
}

User.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
      unique: true
    },
    passwordHash: {
      type: DataTypes.STRING(255),
      allowNull: false
    },
    role: {
      type: DataTypes.ENUM("SUPER_ADMIN", "USER"),
      allowNull: false,
      defaultValue: "USER"
    },
    status: {
      type: DataTypes.ENUM("ENABLED", "DISABLED"),
      allowNull: false,
      defaultValue: "ENABLED"
    }
  },
  {
    sequelize,
    tableName: "users"
  }
);

export class BillType extends Model<InferAttributes<BillType>, InferCreationAttributes<BillType>> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare name: string;
  declare sortOrder: number;
  declare enabled: boolean;
}

BillType.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    name: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    enabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true
    }
  },
  {
    sequelize,
    tableName: "bill_types",
    indexes: [{ unique: true, fields: ["userId", "name"] }]
  }
);

export class BillEntry extends Model<InferAttributes<BillEntry>, InferCreationAttributes<BillEntry>> {
  declare id: CreationOptional<number>;
  declare userId: number;
  declare billTypeId: number;
  declare billTypeName?: string;
  declare occurredOn: string;
  declare amount: string;
  declare note: string | null;
}

BillEntry.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true
    },
    userId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    billTypeId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: false
    },
    occurredOn: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    amount: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false
    },
    note: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  },
  {
    sequelize,
    tableName: "bill_entries",
    indexes: [
      { fields: ["userId", "occurredOn"] },
      { fields: ["userId", "billTypeId"] }
    ]
  }
);

User.hasMany(BillType, { foreignKey: "userId", as: "billTypes" });
BillType.belongsTo(User, { foreignKey: "userId", as: "user" });
User.hasMany(BillEntry, { foreignKey: "userId", as: "billEntries" });
BillEntry.belongsTo(User, { foreignKey: "userId", as: "user" });
BillType.hasMany(BillEntry, { foreignKey: "billTypeId", as: "entries" });
BillEntry.belongsTo(BillType, { foreignKey: "billTypeId", as: "billType" });
