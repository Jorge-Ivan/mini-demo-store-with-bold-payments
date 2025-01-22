import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PaymentsController } from './payments/payments.controller';

@Module({
  imports: [HttpModule, ConfigModule.forRoot()],
  controllers: [AppController, PaymentsController],
  providers: [AppService],
})
export class AppModule {}
