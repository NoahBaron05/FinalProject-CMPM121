export class Inventory {
  items: string[] = [];

  add(itemId: string) {
    this.items.push(itemId);
    console.log("Inventory:", this.items);
  }

  has(itemId: string) {
    return this.items.includes(itemId);
  }

  remove(itemId: string) {
    this.items.splice(this.items.indexOf(itemId), 1);
  }

  getAll() {
    return [...this.items];
  }
}

export class InventoryUI {
  private container = document.getElementById("inventory-items")!;

  update(inventory: Inventory) {
    if (!this.container) return;

    const items = inventory.getAll();

    if (items.length === 0) {
      this.container.innerHTML = "<i>(empty)</i>";
      return;
    }

    this.container.innerHTML = items
      .map((item) => `• ${item}`)
      .join("<br>");
  }
}
