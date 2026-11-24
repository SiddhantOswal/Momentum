import { readWeather } from "../../commands/read-weather.js";
import { noArgs } from "./policy.js";

export const getWeatherTool = {
  name: "get_weather",
  description: "Read the public weather record for Pune.",
  schema: () => noArgs,
  execute: (args, { deps }) => readWeather(args, deps),
};
