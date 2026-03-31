<template>
  <SensorCharts :selectDevice="selectDevice" :type="type" />
</template>

<script setup>
import SensorCharts from "@/components/charts/SensorCharts.vue"

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
