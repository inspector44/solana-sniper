<script setup lang="ts">
import TradeEvent from '../components/TradeEvent.vue'
</script>
<template>
  <div class="about">
    <TradeEvent></TradeEvent>
  </div>
</template>

<style>
@media (min-width: 1024px) {
  .about {
    min-height: 100vh;
    display: flex;
    align-items: center;
  }
}
</style>
