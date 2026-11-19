import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ChatIaComponent } from './components/chat-ia/chat-ia';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ChatIaComponent],
  template: `
    <router-outlet></router-outlet>
    <app-chat-ia></app-chat-ia>
  `
})
export class App {}