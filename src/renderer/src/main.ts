import './app.css'
import { mount } from 'svelte'
import App from './App.svelte'
import { theme } from './lib/stores/theme.svelte'
import { i18n } from './lib/i18n.svelte'

// До монтирования — иначе мелькнёт светлая тема при тёмном предпочтении.
theme.init()
i18n.init()

const target = document.getElementById('app')
if (!target) throw new Error('Не найден корневой элемент #app')

export default mount(App, { target })
