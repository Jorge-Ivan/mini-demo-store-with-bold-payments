import { Component, OnInit } from '@angular/core';
import { ProductService } from '../product.service';
import { DomSanitizer } from '@angular/platform-browser';
import { CommonModule } from '@angular/common';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';
import { PaginatorModule } from 'primeng/paginator';
import { MenuItem, MessageService } from 'primeng/api';
import { MenubarModule } from 'primeng/menubar';
import { ActivatedRoute, Router } from '@angular/router';
import { ToastModule } from 'primeng/toast';
import { OverlayPanelModule } from 'primeng/overlaypanel';
import { DividerModule } from 'primeng/divider';
import { environment } from '../../environments/environment';

interface ProductsResp {
  limit: number;
  skip: number;
  total: number;
  products: any[];
}

interface productSelected {
  id: number,
  title: string,
  price: number,
  category: string,
  image: string,
  quantity: number
}

@Component({
  selector: 'app-product-list',
  templateUrl: './product-list.component.html',
  styleUrls: ['./product-list.component.css'],
  standalone: true,
  imports: [CommonModule, ButtonModule, CardModule, PaginatorModule, MenubarModule, ToastModule, OverlayPanelModule, DividerModule],
  providers: [MessageService]
})
export class ProductListComponent implements OnInit {
  orderId: string | null = null;
  txStatus: string | null = null;
  items: MenuItem[] | undefined;
  localSanitizer = this.sanitizer;
  productsResp!: ProductsResp;
  count: number = 0;
  selectedProducts: productSelected[] = [];
  first: number = 0;
  rows: number = 8;
  conversionRate: number = environment.CONVERSION_RATE;

  constructor(private productService: ProductService,
              private sanitizer: DomSanitizer,
              private route: ActivatedRoute,
              private messageService: MessageService,
              private router: Router
            ) {}

  ngOnInit(): void {
    this.route.queryParams.subscribe(params => {
      this.orderId = params['bold-order-id'] || null;
      this.txStatus = params['bold-tx-status'] || null;
      if(this.orderId!==null && this.txStatus!==null){
        this.showResp();
      }else if(localStorage.getItem('payment_link') && localStorage.getItem('payment_link')!.length > 0){
        this.validateTransaction();
      }
    });
    this.loadMenu();
    this.loadProducts(this.rows, this.first);
    this.loadCacheCart();
  }

  loadMenu() {
    this.items = [
      {
          label: 'Tienda Bold',
          icon: 'pi pi-home'
      }
    ]
  }

  setCacheCart(){
    localStorage.setItem('shop-cache', JSON.stringify(this.selectedProducts));
  }

  loadCacheCart(){
    const shopCache:string = localStorage.getItem('shop-cache')||'[]';
    this.selectedProducts = JSON.parse(shopCache);
    this.count = this.selectedProducts.reduce((acc, product) => acc + product.quantity, 0)
  }

  showResp() {
    switch (this.txStatus?.toUpperCase()) {
      case 'APPROVED':
      case 'PAID':
          this.messageService.add({ severity: 'success', summary: 'Completa', detail: 'Se proceso la compra de la orden: '+this.orderId });
          localStorage.removeItem('shop-cache');
          this.loadCacheCart()
        break;
      case 'REJECTED':
          this.messageService.add({ severity: 'error', summary: 'Rechazada', detail: 'Se rechazo la compra de la orden: '+this.orderId+' consulte su método de pago.' });
        break;
      case 'FAILED':
      case 'CANCELLED':
          this.messageService.add({ severity: 'error', summary: 'No procesado', detail: 'No se pudo procesar la compra de la orden: '+this.orderId+' intente mas tarde.' });
        break;
      default:
        this.messageService.add({ severity: 'error', summary: 'Desconocido', detail: 'Estado de la compra de la orden: '+this.orderId+' sin procesar, revise su método de pago o contacte a la tienda.' });
        break;
    }
    this.clearQueryParams();
  }
  
  clearQueryParams(): void {
    this.router.navigate([], {
      queryParams: {}
    });
  }

  onPageChange(event: any) {
      this.first = event.first;
      this.rows = event.rows;
      this.loadProducts(this.rows, this.first);
  }

  loadProducts(limit:number, skip:number){
    this.productService.getProducts(limit, skip).subscribe((data) => {
      this.productsResp = data;
    });
  }

  toggleSelection(product: any): void {
    let foundItem = this.selectedProducts.find((data) => data.id == product.id);

    if (foundItem) {
      foundItem.quantity++;
    }else {
      const shoppingProduct = {
        id: product.id,
        title: product.title,
        image: product.images[0],
        category: product.category,
        quantity: 1,
        price: product.price
      };
      this.selectedProducts.push(shoppingProduct);
    };
    this.count++;
    this.setCacheCart();
  }

  addQuantity(product:productSelected){
    this.count++;
    product.quantity++;
    this.setCacheCart();
  }

  reduceQuantity(product:productSelected){
    product.quantity--;
    this.count--;
    if(product.quantity<=0){
      this.selectedProducts = this.selectedProducts.filter(item => item.id !== product.id);
    }
    this.setCacheCart();
  }

  removeProduct(product:productSelected){
    this.count -= product.quantity;
    this.selectedProducts = this.selectedProducts.filter(item => item.id !== product.id);
    this.setCacheCart();
  }

  calculateTotalAmount(): number {
    return this.selectedProducts.reduce((acc, product) => acc + (product.price*product.quantity), 0)*this.conversionRate;
  }

  generateBoldLink(): void {
    const orderDescription = `Pago de mi pedido ORD${new Date().getTime()}`;
    const amount = this.calculateTotalAmount();
    localStorage.setItem('shop-cache', JSON.stringify(this.selectedProducts));
    this.productService.generatePaymentLink(orderDescription, amount, environment.bold_currency)
    .subscribe((integrationLink: { payload: { url: string, payment_link: string } }) => {
      const message = this.messageService.add({ 
        severity: 'info', 
        summary: 'Redirigiendo...', 
        detail: 'Seras redirigido a la pasarela de Bold para completar el pago de la orden: '+orderDescription,
        life: 3000,
      });
      setTimeout(() => {
        localStorage.setItem('payment_link', integrationLink.payload.payment_link);
        location.href = integrationLink.payload.url;
      }, 3000);
    });
  }

  validateTransaction(){
    const payment_link = localStorage.getItem('payment_link');
    localStorage.removeItem('payment_link');
    if(payment_link){
      this.productService.getPaymentLink(payment_link)
      .subscribe((dataLink: { status: string }) => {
        this.orderId = payment_link;
        this.txStatus = dataLink.status;
        this.showResp();
      });
    }
  }

  generateBoldButton(): void {
    const orderId = `ORD${new Date().getTime()}`;
    const amount = this.calculateTotalAmount();
    localStorage.setItem('shop-cache', JSON.stringify(this.selectedProducts));
    this.productService.generateIntegrationButton(orderId, amount, environment.bold_currency).subscribe((integrationButton: string) => {
        //eval(integrationButton);
        let btnScript = (0, eval)(integrationButton);
        btnScript();
    });
  }
}
