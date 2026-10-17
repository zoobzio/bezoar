<script setup lang="ts">
const route = useRoute();
const id = Number(route.params.id);

const { data, refresh } = await useFetch(`/api/departures/${id}`);

const passenger = ref("");
const email = ref("");
const seats = ref(1);
const error = ref("");

const book = async () => {
  error.value = "";
  try {
    await $fetch("/api/bookings", {
      method: "POST",
      body: {
        departure: id,
        passenger: passenger.value,
        email: email.value,
        seats: seats.value,
      },
    });
    passenger.value = "";
    email.value = "";
    seats.value = 1;
    await refresh();
  } catch (failure) {
    error.value = failure instanceof Error ? failure.message : String(failure);
  }
};

const cancel = async (booking: number) => {
  await $fetch(`/api/bookings/${booking}`, { method: "DELETE" });
  await refresh();
};
</script>

<template>
  <section v-if="data">
    <h1>{{ data.departure.origin }} → {{ data.departure.destination }}</h1>
    <p>
      Departs
      {{ new Date(data.departure.departs_at).toLocaleString("en-GB") }} ·
      <span class="status">{{ data.departure.status }}</span> ·
      {{ data.departure.seats }} seats
    </p>
    <p v-if="data.departure.note">{{ data.departure.note }}</p>

    <h2>Bookings</h2>
    <table>
      <tbody>
        <tr v-for="booking in data.bookings" :key="booking.id">
          <td>{{ booking.passenger }}</td>
          <td>{{ booking.email }}</td>
          <td>{{ booking.seats }} seat{{ booking.seats === 1 ? "" : "s" }}</td>
          <td>
            <button type="button" @click="cancel(booking.id)">Cancel</button>
          </td>
        </tr>
      </tbody>
    </table>

    <form @submit.prevent="book">
      <h2>Book seats</h2>
      <label>Passenger <input v-model="passenger" required /></label>
      <label>Email <input v-model="email" type="email" required /></label>
      <label>
        Seats <input v-model.number="seats" type="number" min="1" required />
      </label>
      <button type="submit">Book</button>
      <p v-if="error" class="error">{{ error }}</p>
    </form>
  </section>
</template>
