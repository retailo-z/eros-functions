import type {
  RunInput,
  FunctionRunResult,
  Discount,
} from "../generated/api";
import {
  DiscountApplicationStrategy,
} from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.All,
  discounts: [],
};

const FREE_GIFT_MESSAGE = "Cadeau gratuit";
const MAX_FREE_GIFTS = 3;

export function run(input: RunInput): FunctionRunResult {
  // Find all cart lines that have the _free_gift attribute set to "true"
  // Limit to MAX_FREE_GIFTS items
  const freeGiftLines = input.cart.lines
    .filter((line) => line.freeGiftAttribute?.value === "true")
    .slice(0, MAX_FREE_GIFTS);

  // If no free gift lines found, return empty discount
  if (freeGiftLines.length === 0) {
    return EMPTY_DISCOUNT;
  }

  // Create a discount for each free gift line item
  const discounts: Discount[] = freeGiftLines.map((line) => ({
    message: FREE_GIFT_MESSAGE,
    targets: [
      {
        cartLine: {
          id: line.id,
          quantity: line.quantity,
        },
      },
    ],
    value: {
      percentage: {
        value: "100",
      },
    },
  }));

  return {
    discountApplicationStrategy: DiscountApplicationStrategy.All,
    discounts,
  };
}
