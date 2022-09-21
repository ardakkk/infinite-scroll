import { Component } from '../utils/component';
import { intersectionObserver } from '../utils/observer.utils';

type Props<T> = {
    itemMargin: number;
    pageSize: number;
    load: (start: number, limit: number) => Promise<T[]>;
    templateFn: (item: T) => string;
    updateItemFn: (element: HTMLElement, datum: T) => HTMLElement;
}

type State = {
    state: number;
    end: number;
};

const enum ScrollDirection {
    UP = 'up',
    DOWN = 'down',
};

export class VirtualListComponent<T> extends Component<Props<T>, State> {
    TOP_OBSERVER_ELEMENT: HTMLElement;
    BOTTOM_OBSERVER_ELEMENT: HTMLElement;
    ELEMENTS_LIMIT = this.props.pageSize * 2;
    ELEMENTS_POOL = [];

    state = {
        start: 0,
        end: 0,
    };

    init(): void {
        const [topObserver] = intersectionObserver(this.root, async ([entry]) => {
          if (entry.intersectionRatio > 0.1) {
            await this.update(ScrollDirection.UP);
          }
        },
          undefined,
          { className: 'virtual-top-observer absolute-center'}
        );
    
        const [bottomObserver] = intersectionObserver(this.root, async ([entry]) => {
          if (entry.intersectionRatio > 0.1) {
            await this.update(ScrollDirection.DOWN);
          }
        },
          undefined,
          { className: 'virtual-bottom-observer absolute-center'}
        );
        this.TOP_OBSERVER_ELEMENT = topObserver;
        this.BOTTOM_OBSERVER_ELEMENT = bottomObserver;
      }

    async update(trigger: ScrollDirection) {
        switch(trigger) {
            case ScrollDirection.UP:
                await this.#handleTopIntersection();
                break;
            case ScrollDirection.DOWN:
                await this.#handleBottomIntersection();
                break;
        }
            
    }

    #handleTopIntersection = async () => {
         // Move top and bottom observers
        if (this.state.start > 0) {
            const { pageSize } = this.props;
            const data = await this.props.load(this.state.start - pageSize, pageSize);
            // Update start and end position
            this.state.start -= this.props.pageSize;
            this.state.end -= this.props.pageSize;
            // Triggering recycle
            this.#recycle(ScrollDirection.UP, data);
            // Get the current first element Y position
            const firstElementTranslateY = this.ELEMENTS_POOL[0].dataset.translateY;
            // The diff between old and first element position is the value
            // that we need to substract from the bottom spacer
            const diff = +firstElementTranslateY - +this.element.style.paddingTop.replace("px", "");
            this.element.style.paddingBottom = `${Math.max(0, +this.element.style.paddingBottom.replace("px", "") - diff)}px`;
            this.element.style.paddingTop = `${firstElementTranslateY}px`;
            // Move observers to 1st and last rendered item respectively;
            this.TOP_OBSERVER_ELEMENT.style.transform = `translateY(${firstElementTranslateY}px)`;
            this.BOTTOM_OBSERVER_ELEMENT.style.transform = `translateY(${this.ELEMENTS_POOL[this.ELEMENTS_POOL.length - 1].dataset.translateY}px)`;
        }
    }

    #handleBottomIntersection = async () => {
        const { pageSize } = this.props;
        // number of elements rendered
        const count = this.state.end - this.state.start;
        const data = await this.props.load(this.state.end, pageSize);
        // handling the case when element limit has not been reached yet
        if (count < this.ELEMENTS_LIMIT) {
          this.state.end += this.props.pageSize;
          this.#initElementsPool(data);
        } else if (count === this.ELEMENTS_LIMIT) {
          // Update start position
          this.state.start += this.props.pageSize;
          this.state.end += this.props.pageSize;
          this.#recycle(ScrollDirection.DOWN, data);
        }
        const firstElementTranslateY = this.ELEMENTS_POOL[0].dataset.translateY;
        // The diff between old and first element position is the value
        // that we need to substract from the bottom spacer
        const diff = +firstElementTranslateY - +this.element.style.paddingTop.replace("px", "");
        this.element.style.paddingBottom = `${Math.max(0, +this.element.style.paddingBottom.replace("px", "") - diff)}px`;
        // Create empty space that replace moved elements
        this.element.style.paddingTop = `${firstElementTranslateY}px`;
        // Move top and bottom observers
        this.TOP_OBSERVER_ELEMENT.style.transform = `translateY(${firstElementTranslateY}px)`;
        // Move the observer to the last rendered item
        this.BOTTOM_OBSERVER_ELEMENT.style.transform = `translateY(${
          this.ELEMENTS_POOL[this.ELEMENTS_POOL.length - 1].dataset.translateY
        }px)`;
    }


    #initElementsPool(chunk: T[]): void {
        const elements = chunk.map((d, i) => {
            const element = document.createElement("div");
            element.innerHTML = this.props.templateFn(d);
            const itemElement = element.firstElementChild as HTMLElement;
            // Add absolute positiong to each list item
            itemElement.classList.add("absolute-center");
            // Set up virtual list order attribute
            itemElement.dataset.virtualListOrder = `${this.ELEMENTS_POOL.length + i}`;
            itemElement.dataset.translateY = `${0}`;
            return element.firstElementChild as HTMLElement;
        });
        this.ELEMENTS_POOL.push(...elements);
        this.element.append(...elements);
        for (const element of elements) {
            if (element.previousElementSibling !== null) {
                // Getting the previous element if exits
                const siblingElement = element.previousElementSibling as HTMLElement;
                // Getting the previous element height
                const siblingHeight = siblingElement.getBoundingClientRect().height;
                // Getting the previous element translateY
                const siblingTranslateY = +siblingElement.dataset.translateY;
                // Calculating the position of current element
                const translateY = siblingHeight + siblingTranslateY + this.props.itemMargin;
                // Moving element
                element.style.transform = `translateY(${translateY}px)`;
                // Store the position in data attribute
                element.dataset.translateY = `${translateY}`;
            }
        }
      }

    #recycle(direction: ScrollDirection, chunk: T[]) {
        const { pageSize } = this.props;
        if (direction === ScrollDirection.DOWN) {
            // Get the last element from the pool to determine the right position
            let lastCurrentElement = this.ELEMENTS_POOL[
            this.ELEMENTS_POOL.length - 1
                ];
            let lastCurrentElementY =
                +lastCurrentElement.dataset.translateY +
                lastCurrentElement.getBoundingClientRect().height +
                this.props.itemMargin;
            // Select first props.pageSize items from buffer zone
            for (let i = 0; i < pageSize; i++) {
                const element = this.ELEMENTS_POOL[i];
                // Update ordering attribute
                element.dataset.virtualListOrder = `${this.state.start + pageSize + i}`;
                // Update the item content
                this.props.updateItemFn(element, chunk[i]);
                // Update the item position
                element.style.transform = `translateY(${lastCurrentElementY}px)`;
                // Store it for easy access in the next iteration
                element.dataset.translateY = `${lastCurrentElementY}`;
                // Update last element reference and position
                lastCurrentElement = element;
                lastCurrentElementY =
                +lastCurrentElement.dataset.translateY +
                lastCurrentElement.getBoundingClientRect().height +
                this.props.itemMargin;
            } 
        } else {
            // Get first element from the pool to determine the right position
            let firstCurrentElement = this.ELEMENTS_POOL[0];
            // Select last props.pageSize from buffer zone
            for (let i = this.ELEMENTS_LIMIT - 1; i >= pageSize; i--) {
              const element = this.ELEMENTS_POOL[i];
              // Update ordering attribute
              element.dataset.virtualListOrder = `${this.state.start + (i - pageSize)}`;
              // Update the item content
              this.props.updateItemFn(element, chunk[i - pageSize]);
              // Update the item position
              const nextFirstPositionY = +firstCurrentElement.dataset.translateY - this.props.itemMargin - element.getBoundingClientRect().height;
              element.style.transform = `translateY(${nextFirstPositionY}px)`;
              element.dataset.translateY = `${nextFirstPositionY}`;
              // Update last element reference and position
              firstCurrentElement = element;
            }
        }
        
        // Sort pool according to elements order
        this.ELEMENTS_POOL = this.ELEMENTS_POOL.sort((a, b) => {
           return +a.dataset.virtualListOrder - +b.dataset.virtualListOrder; 
        });
    }

    getComponentId(): string {
        return "feed";
    }

    #genList = (items: T[]) => items.map(this.props.templateFn).join("").trim();
};