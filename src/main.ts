import { mount } from "svelte"
import App from "./App.svelte"
import "./style.css"
import "./studio.css"

export default mount(App, { target: document.body })
