<template>
  <BigSensorCard :selectDevice="selectDevice" :type="type" />
</template>

<script setup>
import BigSensorCard from "@/components/device/BigSensorCard.vue"

defineProps({
  selectDevice: {
    type: String,
    default: "",
  },
  type: {
    type: String,
    default: "sensor",
  },
})
</script>
