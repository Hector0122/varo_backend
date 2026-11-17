import { PartialType, OmitType } from '@nestjs/mapped-types';
import { CreateFinancialObjectiveDto } from './create-financial-objective.dto';

// nextPayment = 0 vuelve al pago estimado en la proyección.
export class UpdateFinancialObjectiveDto extends PartialType(
  OmitType(CreateFinancialObjectiveDto, ['type'] as const),
) {}
