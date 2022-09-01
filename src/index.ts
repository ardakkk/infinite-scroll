import { getItem, FeedItem } from "./utils/data.utils";
import { db } from "./utils/db.utils";
import { VirtualListComponent } from "./virtual-list/virtual-list";

export const templateFn = (item: FeedItem) => {
  return `<section class="feed__item">
      <img class="feed__item__img" alt="Avatar for logo" src="${item.url}"/>
      <div class="feed__item__description">
          <h2 class="h2-header">${item.name}</h2>
          <p class="p-text">${item.description}</p>
      </div>
  </section>`
}

const updateItemFn = (element: HTMLElement, { url, description, name }: FeedItem) => {
  element.querySelector<HTMLImageElement>('.feed__item__img').src = url;
  element.querySelector('h2').innerHTML = name;
  element.querySelector('p').innerHTML = description;

  return element;
}

const DB_SIZE = 1000;
const root: HTMLDivElement = document.getElementById('app') as HTMLDivElement;
const DB = db(DB_SIZE, DB_SIZE, getItem);
const feed = new VirtualListComponent<FeedItem>(root, {
  templateFn,
  load: (start, limit) => DB.load(start, limit).then((cursor) => cursor.chunk),
  pageSize: 10,
  itemMargin: 16,
  updateItemFn
})
feed.render();
