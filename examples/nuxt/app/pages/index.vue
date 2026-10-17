<script setup lang="ts">
const { data: departures } = await useFetch("/api/departures");

const when = (date: string | Date) =>
  new Date(date).toLocaleString("en-GB", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin",
  });
</script>

<template>
  <section>
    <h1>Departures</h1>
    <table>
      <thead>
        <tr>
          <th>Route</th>
          <th>Departs</th>
          <th>Status</th>
          <th>Seats left</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="departure in departures" :key="departure.id">
          <td>
            <NuxtLink :to="`/departures/${departure.id}`">
              {{ departure.origin }} → {{ departure.destination }}
            </NuxtLink>
          </td>
          <td>{{ when(departure.departs_at) }}</td>
          <td>
            <span class="status">{{ departure.status }}</span>
          </td>
          <td>
            {{ departure.seats_left }} of
            {{ departure.seats }}
          </td>
        </tr>
      </tbody>
    </table>
  </section>
</template>
