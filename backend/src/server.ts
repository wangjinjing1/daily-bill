import { app } from "./app.js";
import { ensureSuperAdmin } from "./bootstrap.js";
import { config } from "./config.js";
import { sequelize } from "./db.js";
import "./models.js";

async function bootstrap() {
  await sequelize.authenticate();
  await sequelize.sync();
  await ensureSuperAdmin(config.superAdminUsername, config.superAdminPassword);

  app.listen(config.port, () => {
    console.log(`Backend running on port ${config.port}`);
  });
}

bootstrap().catch((error) => {
  console.error("Failed to start backend", error);
  process.exit(1);
});
