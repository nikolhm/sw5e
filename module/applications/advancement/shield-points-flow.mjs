import Advancement from "../../documents/advancement/advancement.mjs";
import HitPointsFlow from "./hit-points-flow.mjs";

/**
 * Inline application that presents shield points selection upon level up.
 */
export default class ShieldPointsFlow extends HitPointsFlow {
  /** @inheritdoc */
  getData() {
    return foundry.utils.mergeObject(super.getData(), {
      isFirstClassLevel: false,
      labels: {
        average: "SW5E.AdvancementShieldPointsAverage",
        roll: "SW5E.AdvancementShieldPointsRollButton"
      }
    });
  }

  /* -------------------------------------------- */

  /**
   * Update the roll result display when the average result is taken.
   * @protected
   */
  _updateRollResult() {
    if (!this.form.elements.useAverage?.checked) return;
    let avg = (this.advancement.hitDieValue / 2) + 1;
    if (this.level === 0) avg = this.advancement.hitDieValue + ((this.advancement.item.system.shldDiceStart - 1) * avg);
    this.form.elements.value.value = avg;
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  _updateObject(event, formData) {
    let value;
    if (formData.useMax) value = "max";
    else if (formData.useAverage) value = "avg";
    else if (Number.isInteger(formData.value)) value = parseInt(formData.value);

    if (value !== undefined) return this.advancement.apply(this.level, { [this.level]: value });

    this.form.querySelector(".rollResult")?.classList.add("error");
    const errorType = formData.value ? "Invalid" : "Empty";
    throw new Advancement.ERROR(game.i18n.localize(`SW5E.AdvancementShieldPoints${errorType}Error`));
  }

  /* -------------------------------------------- */

  /** @inheritdoc */
  rollHitPoints() {
    return this.advancement.actor.rollStarshipShieldPoints(this.advancement.item, this.level);
  }
}