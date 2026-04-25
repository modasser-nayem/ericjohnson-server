import { createServer } from "http";
import app from "./app";
import { initSocket } from "./config/socket";

const server = createServer(app);

initSocket(server);

server.listen(5000, () => {
   console.log("Server running on port 5000");
});
