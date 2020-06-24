import { ActorSheet5e } from "./base.js";

/**
 * An Actor sheet for player character type actors in the D&D5E system.
 * Extends the base ActorSheet5e class.
 * @type {ActorSheet5e}
 */
export class ActorSheet5eCharacter extends ActorSheet5e {

  /**
   * Define default rendering options for the NPC sheet
   * @return {Object}
   */
	static get defaultOptions() {
	  return mergeObject(super.defaultOptions, {
      classes: ["sw5e", "sheet", "actor", "character"],
      width: 672,
      height: 736
    });
  }

  /* -------------------------------------------- */
  /*  Rendering                                   */
  /* -------------------------------------------- */

  /**
   * Get the correct HTML template path to use for rendering this particular sheet
   * @type {String}
   */
  get template() {
    if ( !game.user.isGM && this.actor.limited ) return "systems/sw5e/templates/actors/limited-sheet.html";
    return "systems/sw5e/templates/actors/character-sheet.html";
  }

  /* -------------------------------------------- */

  /**
   * Add some extra data when rendering the sheet to reduce the amount of logic required within the template.
   */
  getData() {
    const sheetData = super.getData();

    // Temporary HP
    let hp = sheetData.data.attributes.hp;
    if (hp.temp === 0) delete hp.temp;
    if (hp.tempmax === 0) delete hp.tempmax;

    // Resources
    sheetData["resources"] = ["primary", "secondary", "tertiary"].reduce((arr, r) => {
      const res = sheetData.data.resources[r] || {};
      res.name = r;
      res.placeholder = game.i18n.localize("SW5E.Resource"+r.titleCase());
      if (res && res.value === 0) delete res.value;
      if (res && res.max === 0) delete res.max;
      return arr.concat([res]);
    }, []);

    // Experience Tracking
    sheetData["disableExperience"] = game.settings.get("sw5e", "disableExperienceTracking");

    // Return data for rendering
    return sheetData;
  }

  /* -------------------------------------------- */

  /**
   * Organize and classify Owned Items for Character sheets
   * @private
   */
  _prepareItems(data) {

    // Categorize items as inventory, powerbook, features, and classes
    const inventory = {
      weapon: { label: "SW5E.ItemTypeWeaponPl", items: [], dataset: {type: "weapon"} },
      equipment: { label: "SW5E.ItemTypeEquipmentPl", items: [], dataset: {type: "equipment"} },
      consumable: { label: "SW5E.ItemTypeConsumablePl", items: [], dataset: {type: "consumable"} },
      tool: { label: "SW5E.ItemTypeToolPl", items: [], dataset: {type: "tool"} },
      backpack: { label: "SW5E.ItemTypeContainerPl", items: [], dataset: {type: "backpack"} },
      loot: { label: "SW5E.ItemTypeLootPl", items: [], dataset: {type: "loot"} }
    };

    // Partition items by category
    let [items, powers, feats, classes] = data.items.reduce((arr, item) => {

      // Item details
      item.img = item.img || DEFAULT_TOKEN;
      item.isStack = item.data.quantity ? item.data.quantity > 1 : false;

      // Item usage
      item.hasUses = item.data.uses && (item.data.uses.max > 0);
      item.isOnCooldown = item.data.recharge && !!item.data.recharge.value && (item.data.recharge.charged === false);
      item.isDepleted = item.isOnCooldown && (item.data.uses.per && (item.data.uses.value > 0));
      item.hasTarget = !!item.data.target && !(["none",""].includes(item.data.target.type));

      // Item toggle state
      this._prepareItemToggleState(item);

      // Classify items into types
      if ( item.type === "power" ) arr[1].push(item);
      else if ( item.type === "feat" ) arr[2].push(item);
      else if ( item.type === "class" ) arr[3].push(item);
      else if ( Object.keys(inventory).includes(item.type ) ) arr[0].push(item);
      return arr;
    }, [[], [], [], []]);

    // Apply active item filters
    items = this._filterItems(items, this._filters.inventory);
    powers = this._filterItems(powers, this._filters.powerbook);
    feats = this._filterItems(feats, this._filters.features);

    // Organize Powerbook and count the number of prepared powers (excluding always, at will, etc...)
    const powerbook = this._preparePowerbook(data, powers);
    const nPrepared = powers.filter(s => {
      return (s.data.level > 0) && (s.data.preparation.mode === "prepared") && s.data.preparation.prepared;
    }).length;

    // Organize Inventory
    let totalWeight = 0;
    for ( let i of items ) {
      i.data.quantity = i.data.quantity || 0;
      i.data.weight = i.data.weight || 0;
      i.totalWeight = Math.round(i.data.quantity * i.data.weight * 10) / 10;
      inventory[i.type].items.push(i);
      totalWeight += i.totalWeight;
    }
    data.data.attributes.encumbrance = this._computeEncumbrance(totalWeight, data);

    // Organize Features
    const features = {
      classes: { label: "SW5E.ItemTypeClassPl", items: [], hasActions: false, dataset: {type: "class"}, isClass: true },
      active: { label: "SW5E.FeatureActive", items: [], hasActions: true, dataset: {type: "feat", "activation.type": "action"} },
      passive: { label: "SW5E.FeaturePassive", items: [], hasActions: false, dataset: {type: "feat"} }
    };
    for ( let f of feats ) {
      if ( f.data.activation.type ) features.active.items.push(f);
      else features.passive.items.push(f);
    }
    classes.sort((a, b) => b.levels - a.levels);
    features.classes.items = classes;

    // Assign and return
    data.inventory = Object.values(inventory);
    data.powerbook = powerbook;
    data.preparedPowers = nPrepared;
    data.features = Object.values(features);
  }

  /* -------------------------------------------- */

  /**
   * A helper method to establish the displayed preparation state for an item
   * @param {Item} item
   * @private
   */
  _prepareItemToggleState(item) {
    if (item.type === "power") {
      const isAlways = getProperty(item.data, "preparation.mode") === "always";
      const isPrepared =  getProperty(item.data, "preparation.prepared");
      item.toggleClass = isPrepared ? "active" : "";
      if ( isAlways ) item.toggleClass = "fixed";
      if ( isAlways ) item.toggleTitle = CONFIG.SW5E.powerPreparationModes.always;
      else if ( isPrepared ) item.toggleTitle = CONFIG.SW5E.powerPreparationModes.prepared;
      else item.toggleTitle = game.i18n.localize("SW5E.PowerUnprepared");
    }
    else {
      const isActive = getProperty(item.data, "equipped");
      item.toggleClass = isActive ? "active" : "";
      item.toggleTitle = game.i18n.localize(isActive ? "SW5E.Equipped" : "SW5E.Unequipped");
    }
  }

  /* -------------------------------------------- */

  /**
   * Compute the level and percentage of encumbrance for an Actor.
   *
   * Optionally include the weight of carried currency across all denominations by applying the standard rule
   * from the PHB pg. 143
   *
   * @param {Number} totalWeight    The cumulative item weight from inventory items
   * @param {Object} actorData      The data object for the Actor being rendered
   * @return {Object}               An object describing the character's encumbrance level
   * @private
   */
  _computeEncumbrance(totalWeight, actorData) {

    // Encumbrance classes
    let mod = {
      tiny: 0.5,
      sm: 1,
      med: 1,
      lg: 2,
      huge: 4,
      grg: 8
    }[actorData.data.traits.size] || 1;

    // Apply Powerful Build feat
    if ( this.actor.getFlag("sw5e", "powerfulBuild") ) mod = Math.min(mod * 2, 8);

    // Add Currency Weight
    if ( game.settings.get("sw5e", "currencyWeight") ) {
      const currency = actorData.data.currency;
      const numCoins = Object.values(currency).reduce((val, denom) => val += denom, 0);
      totalWeight += numCoins / CONFIG.SW5E.encumbrance.currencyPerWeight;
    }

    // Compute Encumbrance percentage
    const enc = {
      max: actorData.data.abilities.str.value * CONFIG.SW5E.encumbrance.strMultiplier * mod,
      value: Math.round(totalWeight * 10) / 10,
    };
    enc.pct = Math.min(enc.value * 100 / enc.max, 99);
    enc.encumbered = enc.pct > (2/3);
    return enc;
  }

  /* -------------------------------------------- */
  /*  Event Listeners and Handlers
  /* -------------------------------------------- */

  /**
   * Activate event listeners using the prepared sheet HTML
   * @param html {HTML}   The prepared HTML object ready to be rendered into the DOM
   */
	activateListeners(html) {
    super.activateListeners(html);
    if ( !this.options.editable ) return;

    // Inventory Functions
    html.find(".currency-convert").click(this._onConvertCurrency.bind(this));

    // Item State Toggling
    html.find('.item-toggle').click(this._onToggleItem.bind(this));

    // Short and Long Rest
    html.find('.short-rest').click(this._onShortRest.bind(this));
    html.find('.long-rest').click(this._onLongRest.bind(this));

    // Death saving throws
    html.find('.death-save').click(this._onDeathSave.bind(this));
  }

  /* -------------------------------------------- */

  /**
   * Handle rolling a death saving throw for the Character
   * @param {MouseEvent} event    The originating click event
   * @private
   */
  _onDeathSave(event) {
    event.preventDefault();
    return this.actor.rollDeathSave({event: event});
  }

  /* -------------------------------------------- */


  /**
   * Handle toggling the state of an Owned Item within the Actor
   * @param {Event} event   The triggering click event
   * @private
   */
  _onToggleItem(event) {
    event.preventDefault();
    const itemId = event.currentTarget.closest(".item").dataset.itemId;
    const item = this.actor.getOwnedItem(itemId);
    const attr = item.data.type === "power" ? "data.preparation.prepared" : "data.equipped";
    return item.update({[attr]: !getProperty(item.data, attr)});
  }

  /* -------------------------------------------- */

  /**
   * Take a short rest, calling the relevant function on the Actor instance
   * @param {Event} event   The triggering click event
   * @private
   */
  async _onShortRest(event) {
    event.preventDefault();
    await this._onSubmit(event);
    return this.actor.shortRest();
  }

  /* -------------------------------------------- */

  /**
   * Take a long rest, calling the relevant function on the Actor instance
   * @param {Event} event   The triggering click event
   * @private
   */
  async _onLongRest(event) {
    event.preventDefault();
    await this._onSubmit(event);
    return this.actor.longRest();
  }

  /* -------------------------------------------- */

  /**
   * Handle mouse click events to convert currency to the highest possible denomination
   * @param {MouseEvent} event    The originating click event
   * @private
   */
  async _onConvertCurrency(event) {
    event.preventDefault();
    return Dialog.confirm({
      title: `${game.i18n.localize("SW5E.CurrencyConvert")}`,
      content: `<p>${game.i18n.localize("SW5E.CurrencyConvertHint")}</p>`,
      yes: () => this.actor.convertCurrency()
    });
  }
}
