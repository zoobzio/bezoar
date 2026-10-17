# Examples

| Example                  | Directory           | Description                                                         |
| ------------------------ | ------------------- | ------------------------------------------------------------------- |
| [`database`](./database) | `examples/database` | The database of a fictional night-train company, built with the kit |
| [`nuxt`](./nuxt)         | `examples/nuxt`     | Its booking desk: the app that imports the build and serves it      |

The two are one example in two packages: `database` is what a data team
would own and `nuxt` is the app that reads it. The app never reads a SQL
file; it imports the build.
