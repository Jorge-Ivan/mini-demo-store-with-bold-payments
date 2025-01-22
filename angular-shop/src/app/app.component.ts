import { Component } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { ProductListComponent } from './product-list/product-list.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  standalone: true,
  imports: [ProductListComponent, HttpClientModule]
})
export class AppComponent {
  title = 'mi-shop-angular';
}
