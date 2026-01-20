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

export function run(input: RunInput): FunctionRunResult {
  // Find all cart lines that have the _free_gift attribute set to "true"
  const freeGiftLines = input.cart.lines.filter((line) => {
    return line.freeGiftAttribute?.value === "true";
  });

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
