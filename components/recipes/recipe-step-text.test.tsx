import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecipeStepText } from "./recipe-step-text";

describe("RecipeStepText", () => {
  it("emphasizes the mixing warning for the banana bread", () => {
    const html = renderToStaticMarkup(
      <RecipeStepText
        locale="fr"
        recipeSlug="banana-bread-du-kona-inn"
        text="Incorporer la farine sans trop travailler la pâte."
      />,
    );

    expect(html).toContain(
      '<span class="font-semibold">sans trop travailler la pâte</span>',
    );
  });

  it("leaves other recipes unchanged", () => {
    const html = renderToStaticMarkup(
      <RecipeStepText
        locale="fr"
        recipeSlug="cookies-americains"
        text="Mélanger sans trop travailler la pâte."
      />,
    );

    expect(html).toBe("Mélanger sans trop travailler la pâte.");
  });
});
