import express from 'express';
import { createServer } from 'http';
import { socketService } from "./socket/SocketService";
import { init } from './bot'
import { RabbitMQService } from './queue';
import { TradeType, TradeEvent } from './types';

const app = express();
const server = createServer(app);
socketService.init(server);

app.use(express.json());

app.get('/api', async (req, res) => {
  await init();
  res.json({ message: 'Hello from Express!' });
});

app.get('/initGraphql', async (req, res) => {
  await RabbitMQService.getInstance().connect();
  res.json({ message: 'Rabbitmq Initialized!' });
});

app.get('/send', async (req, res) => {
  await RabbitMQService.getInstance().sendQueueMessage("trades", { Mint: "asdsad", Amount: "10", Signature: "asd", Type: TradeType.BuyRequested });
  RabbitMQService.getInstance().consumeQueueMessages('trades', async (msg) => {
    if(!msg) return;
    let message : TradeEvent = JSON.parse(msg.content.toString());
    socketService.emitToAll(message.Type.toString(), message);
    console.log("Message distributed");
  });
  res.json({ message: 'Message sent!' });
});

app.post('/api/messages', (req, res) => {
  const { message } = req.body;
  socketService.emitToAll('newMessage', message);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
