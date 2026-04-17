import { Sequelize } from "sequelize";
import { config } from "./config.js";

export const sequelize = new Sequelize({
  dialect: "mysql",
  host: config.dbHost,
  port: config.dbPort,
  database: config.dbName,
  username: config.dbUser,
  password: config.dbPassword,
  logging: false,
  timezone: "+08:00"
});

