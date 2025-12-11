export class Inventory {
  items: string[] = [];

  add(itemId: string) {
    this.items.push(itemId);
    // keep lightweight logging for debug, safe if needed
    if (typeof window !== "undefined") {
      const w = window as Window & { DEBUG?: boolean };
      if (w.DEBUG) console.log("Inventory:", this.items);
    }
  }

  has(itemId: string) {
    return this.items.includes(itemId);
  }

  remove(itemId: string) {
    const idx = this.items.indexOf(itemId);
    if (idx >= 0) this.items.splice(idx, 1);
  }

  getAll() {
    return [...this.items];
  }
}

export class InventoryUI {
  private container: HTMLElement | null;

  constructor() {
    this.container = document.getElementById("inventory-items");
  }

  update(inventory: Inventory) {
    const container = this.container ??
      document.getElementById("inventory-items");
    if (!container) return;

    const items = inventory.getAll();

    if (items.length === 0) {
      container.innerHTML = "<i>(empty)</i>";
      return;
    }

    container.innerHTML = items.map((item) => `• ${item}`).join("<br>");
  }
}
