<template>
  <div class="flex flex-col items-center justify-center min-h-screen p-4">
    <div v-for="trade in trades" :key="trade.signature" class="w-full max-w-md p-4 bg-white shadow-lg rounded-lg my-2">
      <div class="flex justify-between items-center">
        <div class="text-lg font-semibold">{{ trade.mint }}</div>
        <div class="px-3 py-1 text-sm rounded-full" :class="statusColor(trade.type)">
          {{ tradeTypeDisplay(trade.type) }}
        </div>
      </div>
      <div class="mt-2">
        <div class="text-sm text-gray-600">Amount: {{ trade.amount }}</div>
        <div class="w-full bg-gray-200 rounded-full h-2.5 dark:bg-gray-700 mt-2">
          <div :class="progressBarColor(trade.type)" :style="{ width: tradeLifetime(trade.type) + '%' }" class="h-2.5 rounded-full"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { io } from 'socket.io-client';

const trades = ref([]);

const tradeTypeDisplay = (type) => {
  switch (type) {
    case 'BuyRequested': return 'Buy Requested';
    case 'SellRequested': return 'Sell Requested';
    case 'BuyConfirmed': return 'Buy Confirmed';
    case 'SellConfirmed': return 'Sell Confirmed';
    case 'BuyConfirmError': return 'Buy Confirm Error';
    case 'SellConfirmError': return 'Sell Confirm Error';
    default: return 'Unknown Type';
  }
};

const progressBarColor = (type) => {
  switch (type) {
    case 'BuyRequested':
    case 'SellRequested': return 'bg-blue-500';
    case 'BuyConfirmed':
    case 'SellConfirmed': return 'bg-green-500';
    case 'BuyConfirmError':
    case 'SellConfirmError': return 'bg-red-500';
    default: return 'bg-gray-500';
  }
};

const statusColor = (type) => {
  switch (type) {
    case 'BuyRequested':
    case 'SellRequested': return 'bg-blue-100 text-blue-800';
    case 'BuyConfirmed':
    case 'SellConfirmed': return 'bg-green-100 text-green-800';
    case 'BuyConfirmError':
    case 'SellConfirmError': return 'bg-red-100 text-red-800';
    default: return 'bg-gray-100 text-gray-800';
  }
};

const tradeLifetime = (type) => {
  switch (type) {
    case 'BuyRequested':
    case 'SellRequested': return 25;
    case 'BuyConfirmed':
    case 'SellConfirmed': return 100;
    case 'BuyConfirmError':
    case 'SellConfirmError': return 50;
    default: return 0;
  }
};

const connectSocketIO = () => {
  const socket = io('http://localhost:3000');

  socket.on('connect', () => console.log('Socket.io connected'));

  const events = ['BuyRequested', 'SellRequested', 'BuyConfirmed', 'SellConfirmed', 'BuyConfirmError', 'SellConfirmError'];
  events.forEach(event => {
    socket.on(event, (tradeEvent) => {
      console.log(`Socket.io tradeEvent: ${event}`, tradeEvent);
      trades.value.push(tradeEvent);
    });
  });

  socket.on('disconnect', () => console.log('Socket.io disconnected'));
};

onMounted(connectSocketIO);
</script>

<style scoped>
/* Additional styles if needed */
</style>
