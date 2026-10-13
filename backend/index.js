import express from "express"
import dotenv from "dotenv"
// Trigger restart v2
import connectDB from "./app/dbConfig/dbConfig.js"
import setupRoutes from "./app/routes/index.js";
import cors from "cors"
import { createServer } from "http";
import { initSocket } from "./app/lib/socket.js";
import { startScheduler } from "./app/utils/scheduler.js";

dotenv.config({ override: true });

// Safety net: log unexpected async errors instead of letting one failed background task
// crash the whole API (Node exits on unhandled rejections by default).
process.on("unhandledRejection", (reason) => {
  console.error("[unhandledRejection]", reason);
});
process.on("uncaughtException", (err) => {
  console.error("[uncaughtException]", err);
});
const app = express();
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOSTNAME || "0.0.0.0";

// Start background scheduler for reminders
startScheduler();

app.use(cors());
app.use(express.json());


app.get('/', (req, res) => {
  res.send('Hello, World!');
});
connectDB();
setupRoutes(app);




const httpServer = createServer(app);
initSocket(httpServer);

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`server is running on port ${PORT}`)
})
