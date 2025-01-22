import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map } from 'rxjs';
import { environment } from '../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ProductService {

  constructor(private http: HttpClient) {}

  getProducts(limit: number = 30, skip: number = 0): Observable<any> {
    return this.http.get<any>(`${environment.apiUrlData}products?limit=${limit}&skip=${skip}`);
  }

  generateIntegrationButton(orderId: string, amount: number, currency: string): Observable<string> {
    const payload = { orderId, amount, currency };
    return this.http.post<{ hash: string }>(`${environment.apiUrl}payments/generate-hash`, payload)
      .pipe(
        map(response => {
        return `
        const checkout = new BoldCheckout({
          orderId: "${orderId}",
          currency: "${environment.bold_currency}",
          amount: "${amount}",
          apiKey: "${environment.bold_apikey}",
          redirectionUrl: "${environment.appUrl}",
          integritySignature: "${response.hash}"
        });
        checkout.open();`;
      })
      );
  }

  generatePaymentLink(orderId: string, amount: number, currency: string): Observable<any> {
    const payload = { orderId, amount, currency };
    return this.http.post(`${environment.apiUrl}payments/get-payment-link`, payload);
  }

  getPaymentLink(payment_link: string): Observable<any> {
    return this.http.get(`${environment.apiUrl}payments/get-payment-link/${payment_link}`);
  }
}