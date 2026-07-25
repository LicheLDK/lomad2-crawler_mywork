import { Module } from '@nestjs/common';
import { RentalClient } from './rental.client';
import { RentalService } from './rental.service';

@Module({
  providers: [RentalClient, RentalService],
  exports: [RentalClient, RentalService],
})
export class RentalModule {}
