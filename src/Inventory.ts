export class Inventory {
  items: string[] = [];

  add(itemId: string) {
    this.items.push(itemId);
    console.log("Inventory:", this.items);
  }

  has(itemId: string) {
    return this.items.includes(itemId);
  }

  getAll() {
    return [...this.items];
  }
}
