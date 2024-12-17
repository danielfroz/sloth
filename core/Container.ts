import { Container, createContainer } from "./di/index.ts";

/** container shall be used as singleton throughout the application's lifecycle */
export const container: Container = createContainer()