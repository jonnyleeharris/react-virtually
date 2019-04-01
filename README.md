# react-virtually

React Virtually is a performant virtualized list component for react that works with just in time measured content with dynamic heights. It supports jump to index, and adding/removing of items from the top and bottom of the list (ideal for implementing chat).

### Motivation

Rendering large data sets causes performance issues. Optimisation here is key for a healthy user experience. This is especially important on lower end mobile devices and/or when you are dealing with huge data sets. List virtualistion allows us to render only the items we need to show on screen at any given time.

### Features

  - Variable item height (measured just in time)
  - Expandable data set. You can prepend or append items to the list and the scroll position won't jump around.
  - Jump to index
  - Achieved through the use of props (no need for refs)

### Installation

The react-virtually module is available on NPM: `npm install react-virtually`

## Usage

### Basic usage


```tsx
<InfiniteList
  startIndex={0}
  endIndex={1000}
  itemRendererFactory={ 
    (index:number):JSX.Element => {
      return(<div key={index}
        style={{                  
          padding:10,
        }}>        
         This is item: {index}        
      </div>);
    }  
  }
/>
```

### Props

|Name|Type|Required|Description|
|:--|:----:|:----------:|:----------|
|startIndex|number|true|Defines the start index from which to draw rows (the begining of your available data-set - this will typically be 0). Cannot be below 0.
endIndex|number|true|Defines the end index at which to stop drawing rows (the end of your available data-set - this will usually be the length of your data-set)
jumpToIndex|number|false|Determines an index to jump to. This list will jump to the scroll position at which the item will appear as close to the top of the list as possible.
onUserScrolled|(scrollTop:number)|false|A callback that will be called when a scroll event occurs on the list - passing the scroll top. This is useful if you want to add infinite loading logic.
itemRendererFactory|(index:number):JSX.Element|true|The item renderer function must return a JSX element for a particular row. This row index will always be within the startIndex and endIndex. At this point you should already have the data loaded for the item. If you want to lazily load data, see [lazy loading](#lazy-loading)

## Lazy-loading

When dealing with large data sets you probably want to optimize network calls as well as your rendering strategy. To do this with React Virtually you can expand your start and end index whenever you want to append or prepend data to the list. Below is an example of how you might do this for a chat implementation:

```ts
export interface ChatMessage {
  readonly message:String;
}

export interface ChatMessages {
  getMessages():ChatMessage[];
}

export class TestChatMessages implements ChatMessages {

  private _messages:ChatMessage[];

  private getRandomMessage():string {
    let baseContent = "This is some message, it has an index. "
    let count = Math.round((Math.random()*10))+1;
    return Array(count).fill(baseContent).toString()
  }

  constructor(total:number=100) {
    this._messages = this._getMessages(total);
  }

  _getMessages(total:number=100):ChatMessage[] {
    return Array(total).fill(0).map((v,index) => {
      let m:ChatMessage = {        
        message: index.toString() +": "+ this.getRandomMessage()
      };
      return m;      
    });
  }
  
  getMessages():ChatMessage[] {
    return this._messages;
  }
}
```

```tsx
import React, { Component } from 'react';
import { VirtuallyList } from "react-virtually";
import './App.css';
import { TestChatMessages } from './ChatMessages';

export interface AppState {
  itemIndex?:number  
  startIndex:number,
  endIndex:number
}

export interface AppProps {}

class App extends Component<AppProps,AppState> {

  private messages = new TestChatMessages(100000).getMessages();

  constructor(props:AppProps) {
    super(props);
    this.state = {
      itemIndex: this.messages.length-1, // this will start the list at the bottom      
      startIndex: this.messages.length-50,
      endIndex: this.messages.length
    }
  }

  render() {
    return (      
      <div style={{
        width: 500,
        height: 500
      }}>
      <VirtuallyList
        startIndex={this.state.startIndex}
        endIndex={this.state.endIndex}
        jumpToIndex={this.state.itemIndex}
        onUserScrolled={(top:number) => {
          this.setState({
            itemIndex: undefined
          })
          if(top <= 500) {
            this.setState({
              startIndex: Math.max(this.state.startIndex-50,0)
            })
          }            
        }}
        itemRendererFactory={ 
          (index:number):JSX.Element => {
            let message = this.messages[index];
            return(<div key={index} 
              style={{                  
                padding:10,
              }}>
              <div style={{                          
                backgroundColor: "skyblue",
                padding: 16,        
                borderRadius: "0.4em"
              }}>
                {message.message}
              </div>
            </div>);
          }  
        }
      />        
      </div>
    )
  }
}

export default App;
```




### Tests

Coming soon