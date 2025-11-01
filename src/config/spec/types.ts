export interface ParapetSpec {
  readonly tenants?: readonly TenantSpec[];
  readonly services?: readonly ServiceSpec[];
  readonly users?: readonly UserSpec[];
  readonly routes?: readonly RouteSpec[];
}

export interface TenantSpec {
  readonly id: string;
  readonly name?: string;
}

export interface ServiceSpec {
  readonly id: string;
  readonly provider: string;
  readonly model?: string;
  readonly apiKey_ref?: string;
}

export interface UserSpec {
  readonly id: string;
  readonly role?: string;
}

export interface RouteSpec {
  readonly id: string;
  readonly serviceId: string;
  readonly budget_ref?: string;
}
