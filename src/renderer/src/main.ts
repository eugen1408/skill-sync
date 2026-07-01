import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'

const target = document.getElementById('app')
if (!target) throw new Error('Не найден корневой элемент #app')

export default mount(App, { target })
