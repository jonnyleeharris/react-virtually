import React, { Component } from 'react';
import { ItemSizeAverager } from './ItemSizeAverager';

enum OffsetType {
  fromTop, fromBottom
}

export interface VirtuallyListState {
  totalContentSize:number;
  range:ListRange,  
  offset:number;  
  offsetType:OffsetType;
  scrollToIndexRequested?:boolean,
  scrollIndex?:number
  scheduledScrollOffset?:number,
}

export interface VirtuallyListProps {
  itemRendererFactory: (index:number) => JSX.Element;
  startIndex:number,
  endIndex:number
  jumpToIndex?:number
  onUserScrolled?:(top:number) => void
}

export declare type ListRange = {
  start: number;
  end: number;
};

export declare type ItemIndex = {
  index:number;
  positionOffset:number
  offsetType:OffsetType
}

export class VirtuallyList extends Component<VirtuallyListProps,VirtuallyListState> {  

  private _scrollContainer = React.createRef<HTMLDivElement>();
  private _renderedItems = React.createRef<HTMLDivElement>();

  private _averager = new ItemSizeAverager();

  private _getRangeForCurrentScrollOffset():ListRange {
    const scrollOffset = this._measureScrollOffset();
    this._lastScrollOffset = scrollOffset;
    this._removalFailures = 0;

    const itemSize = this._averager.getAverageItemSize();
    const firstVisibleIndex =    
        Math.min(this.props.endIndex, Math.floor(scrollOffset / itemSize)) + this.props.startIndex;
    const bufferSize = Math.ceil(this._maxBufferPx / itemSize);
    const range = this._expandRange(
        this._getVisibleRangeForIndex(firstVisibleIndex), bufferSize, bufferSize);        

    return range;
  }

  private _renderContentForCurrentOffset(callback?:() => void) {

    let range = this._getRangeForCurrentScrollOffset();    
    const itemSize = this._averager.getAverageItemSize();

    this.setState({
      range: range,
      offset: itemSize * (range.start - this.props.startIndex),
      offsetType: OffsetType.fromTop
    },callback);
  } 

  constructor(props:VirtuallyListProps,context:any) {
    super(props,context);    
    
    let startingRange = this._getRangeForCurrentScrollOffset();        
    this.state = {
      totalContentSize: this._averager.getAverageItemSize() * (this._getDataLength()),
      range: startingRange,
      offset: this._averager.getAverageItemSize() * (startingRange.start - props.startIndex),
      offsetType: OffsetType.fromTop
    };
  }

  private _jumpToIndex(itemIndex:ItemIndex) {    
    let index = itemIndex.index;
    if(index < this.props.startIndex || index > this.props.endIndex) { return; }
      let attempts = 0;
      let maxAttempts = 10;
      let attempt = () => {        
        attempts++; 
        if(attempts > maxAttempts) { return; }
        if(!this._scrollContainer.current) { return; }         

        let estimatedOffset = (index-this.props.startIndex) / (this.props.endIndex-this.props.startIndex) * this.state.totalContentSize;
        this._scrollContainer.current.scrollTop = estimatedOffset;   

        this._renderContentForCurrentOffset(() => {                    
          if(this.state.range.start <= index && this.state.range.end >= index) {
            let scrollContainer = this._scrollContainer.current;
            if(!scrollContainer) { return; }
            let offsetToRenderer = this._measureRangeSize({
              start: this.state.range.start,
              end: index
            });
            
            let delta = this.state.offset - scrollContainer.scrollTop - itemIndex.positionOffset;
            let scrollTop = scrollContainer.scrollTop + delta + offsetToRenderer;
            scrollContainer.scrollTop = scrollTop;
          } else {
            attempt();
          }
        });        
      };      
      attempt();
  }

  componentDidMount() {    
    let startingRange = this._getRangeForCurrentScrollOffset();
    this.setState( {
      totalContentSize: this._averager.getAverageItemSize() * (this._getDataLength()),
      range: startingRange,
      offset: this._averager.getAverageItemSize() * (startingRange.start - this.props.startIndex),
      offsetType: OffsetType.fromTop
    }, () => {
      if(this.props.jumpToIndex != null) {
        this._jumpToIndex({
          index: this.props.jumpToIndex,
          offsetType: OffsetType.fromTop,
          positionOffset: 0
        });
      }
    })
  }

  private _expandRange(range: ListRange, expandStart: number, expandEnd: number): ListRange {   
    const start = Math.max(this.props.startIndex, range.start - expandStart);
    const end = Math.min(this.props.endIndex, range.end + expandEnd);    
    return {start, end};
  }

  private _measureScrollOffset():number {
    let container = this._scrollContainer.current;
    if(!container) return 0;
    return container.scrollTop;
  }

  private _getDataLength():number {
    return this.props.endIndex - this.props.startIndex;
  }

  private _getViewportSize():number {
    let container = this._scrollContainer.current;
    if(!container) return 0;
    return container.getBoundingClientRect().height;
  }

  private _getVisibleRangeForIndex(startIndex: number): ListRange {
    const range: ListRange = {
      start: startIndex,
      end: startIndex +
          Math.ceil(this._getViewportSize() / this._averager.getAverageItemSize())
    };    
    const extra = range.end - this.props.endIndex;
    if (extra > 0) {
      range.start = Math.max(0, range.start - extra);
    }
    return range;
  }

  private _measureRangeSize(range: ListRange): number {
    let element = this._renderedItems.current;
    if(!element) { return 0; }
    let children = element.children;
    if (range.start >= range.end) {
      return 0;
    }

    let renderedRange = this.state.range;
    if (range.start < renderedRange.start || range.end > renderedRange.end) {
      throw Error(`Error: attempted to measure an item that isn't rendered.`);
    }
    // The index into the list of rendered views for the first item in the range.
    const renderedStartIndex = range.start - renderedRange.start;
    // The length of the range we're measuring.
    const rangeLen = range.end - range.start;

    // Loop over all root nodes for all items in the range and sum up their size.
    let totalSize = 0;
    let i = rangeLen;

    while (i--) {
      const child = children[i + renderedStartIndex];
      let height = child.clientHeight;
      totalSize += height;
    }

    return totalSize;
  }
  
  private _lastScrollOffset:number = 0;  
  private _minBufferPx:number = 200;
  private _maxBufferPx:number = 400;
  private _removalFailures:number = 0;

  private _rangesEqual(r1: ListRange, r2: ListRange): boolean {
    return r1.start == r2.start && r1.end == r2.end;
  }

  private _getContentSize():number {
    return (this._renderedItems.current) ? this._renderedItems.current.offsetHeight : 0;
  }

  private _updateRenderedContentAfterScroll() {

    if(this._ignoreNextScrollEvent) {      
      console.log("ignoring") ;
      this._ignoreNextScrollEvent = false;
      return;
    }

    const scrollOffset = this._measureScrollOffset();
    // The delta between the current scroll offset and the previously recorded scroll offset.
    let scrollDelta = scrollOffset - this._lastScrollOffset;
    // The magnitude of the scroll delta.
    let scrollMagnitude = Math.abs(scrollDelta);

    // The currently rendered range.
    const renderedRange = this.state.range;

    //let lastOffset = this._lastRenderedContentOffset;
    let lastOffset = this.state.offset;
    //let lastContentSize = this._lastRenderedContentSize;
    let lastContentSize = this._getContentSize();

    // If we're scrolling toward the top, we need to account for the fact that the predicted amount
    // of content and the actual amount of scrollable space may differ. We address this by slowly
    // correcting the difference on each scroll event.
    let offsetCorrection = 0;    
    if (scrollDelta < 0) {
      // The content offset we would expect based on the average item size.
      const predictedOffset = (renderedRange.start - this.props.startIndex)* this._averager.getAverageItemSize();
      // The difference between the predicted size of the unrendered content at the beginning and
      // the actual available space to scroll over. We need to reduce this to zero by the time the
      // user scrolls to the top.
      // - 0 indicates that the predicted size and available space are the same.
      // - A negative number that the predicted size is smaller than the available space.
      // - A positive number indicates the predicted size is larger than the available space
      const offsetDifference = predictedOffset - lastOffset;
      // The amount of difference to correct during this scroll event. We calculate this as a
      // percentage of the total difference based on the percentage of the distance toward the top
      // that the user scrolled.
//      console.log(offsetDifference);
      offsetCorrection = Math.round(offsetDifference *
          Math.max(0, Math.min(1, scrollMagnitude / (scrollOffset + scrollMagnitude))));

      // Based on the offset correction above, we pretend that the scroll delta was bigger or
      // smaller than it actually was, this way we can start to eliminate the difference.
      scrollDelta = scrollDelta - offsetCorrection;
      
      scrollMagnitude = Math.abs(scrollDelta);
    }

    // The current amount of buffer past the start of the viewport.
    const startBuffer = this._lastScrollOffset - lastOffset;
    // The current amount of buffer past the end of the viewport.
    const endBuffer = (lastOffset + lastContentSize) -
        (this._lastScrollOffset + this._getViewportSize());
    // The amount of unfilled space that should be filled on the side the user is scrolling toward
    // in order to safely absorb the scroll delta.
    const underscan = scrollMagnitude + this._minBufferPx -
        (scrollDelta < 0 ? startBuffer : endBuffer);

    // Check if there's unfilled space that we need to render new elements to fill.
    if (underscan > 0) {
      // Check if the scroll magnitude was larger than the viewport size. In this case the user
      // won't notice a discontinuity if we just jump to the new estimated position in the list.
      // However, if the scroll magnitude is smaller than the viewport the user might notice some
      // jitteriness if we just jump to the estimated position. Instead we make sure to scroll by
      // the same number of pixels as the scroll magnitude.      
      if (scrollMagnitude >= this._getViewportSize()) {                
        this._renderContentForCurrentOffset();
      } else {
        // The number of new items to render on the side the user is scrolling towards. Rather than
        // just filling the underscan space, we actually fill enough to have a buffer size of
        // `maxBufferPx`. This gives us a little wiggle room in case our item size estimate is off.
        const addItems = Math.max(0, Math.ceil((underscan - this._minBufferPx + this._maxBufferPx) /
            this._averager.getAverageItemSize()));
        // The amount of filled space beyond what is necessary on the side the user is scrolling
        // away from.
        const overscan = (scrollDelta < 0 ? endBuffer : startBuffer) - this._minBufferPx +
            scrollMagnitude;
        // The number of currently rendered items to remove on the side the user is scrolling away
        // from. If removal has failed in recent cycles we are less aggressive in how much we try to
        // remove.
        const unboundedRemoveItems = Math.floor(
            overscan / this._averager.getAverageItemSize() / (this._removalFailures + 1));
        const removeItems =
            Math.min(renderedRange.end - renderedRange.start, Math.max(0, unboundedRemoveItems));

        // The new range we will tell the viewport to render. We first expand it to include the new
        // items we want rendered, we then contract the opposite side to remove items we no longer
        // want rendered.
        const range = this._expandRange(
            renderedRange, scrollDelta < 0 ? addItems : 0, scrollDelta > 0 ? addItems : 0);
        if (scrollDelta < 0) {
          range.end = Math.max(range.start + 1, range.end - removeItems);
        } else {
          range.start = Math.min(range.end - 1, range.start + removeItems);
        }

        // The new offset we want to set on the rendered content. To determine this we measure the
        // number of pixels we removed and then adjust the offset to the start of the rendered
        // content or to the end of the rendered content accordingly (whichever one doesn't require
        // that the newly added items to be rendered to calculate.)
        let contentOffset: number = 0;
        let offsetType:OffsetType;        
        if (scrollDelta < 0) { // scrolling up
          let removedSize = this._measureRangeSize({
            start: range.end,
            end: renderedRange.end,
          });
          // Check that we're not removing too much.
          if (removedSize <= overscan) {
            contentOffset = lastOffset + lastContentSize - removedSize;
            this._removalFailures = 0;
          } else {
            // If the removal is more than the overscan can absorb just undo it and record the fact
            // that the removal failed so we can be less aggressive next time.
            range.end = renderedRange.end;
            contentOffset = lastOffset + lastContentSize;
            this._removalFailures++;
          }
          offsetType = OffsetType.fromBottom;
        } else {
          const removedSize = this._measureRangeSize({
            start: renderedRange.start,
            end: range.start,
          });
          // Check that we're not removing too much.
          if (removedSize <= overscan) {
            contentOffset = lastOffset + removedSize;
            this._removalFailures = 0;
          } else {
            // If the removal is more than the overscan can absorb just undo it and record the fact
            // that the removal failed so we can be less aggressive next time.
            range.start = renderedRange.start;
            contentOffset = lastOffset;
            this._removalFailures++;
          }
          offsetType = OffsetType.fromTop;
        }

        // Set the range and offset we calculated above.        
        //console.log("updating range and offset");
        this.setState({
          range: range,
          offset: contentOffset + offsetCorrection,
          offsetType: offsetType
        });
      }
    } else if (offsetCorrection) {
      // Even if the rendered range didn't change, we may still need to adjust the content offset to
      // simulate scrolling slightly slower or faster than the user actually scrolled.
      this.setState({
        offset: lastOffset + offsetCorrection,
        offsetType: OffsetType.fromTop
      })
    }
    // Save the scroll offset to be compared to the new value on the next scroll event.
    this._lastScrollOffset = scrollOffset;
  }

  private _ignoreNextScrollEvent:boolean = false;

  private _getFirstIndexInView(from : OffsetType = OffsetType.fromTop):ItemIndex {
    let scrollContainer = this._scrollContainer.current;
    let itemsContainer = this._renderedItems.current;
    if(!scrollContainer || !itemsContainer) { return { index: 0, positionOffset: 0, offsetType: from } }

    let delta = scrollContainer.scrollTop - this.state.offset;
    
    let children = itemsContainer.children;    
    
    if(from == OffsetType.fromTop) {
      let acc:number = 0;
      for (var index = 0; index < children.length; index++) {
        const child = children[index];
        const h = child.getBoundingClientRect().height;
        
        if(acc >= delta) {
          return {
            index: index + this.state.range.start,
            positionOffset: acc-delta,
            offsetType: from
          }
        }
        acc += h
      }

      return {
        index: this.state.range.start,
        positionOffset: 0,
        offsetType: from
      }

    } else {
      let acc = this._getContentSize();
      let delta = scrollContainer.scrollTop + this._getViewportSize() - this.state.offset;
      for(var index = children.length-1; index >= 0; index--) {
        const child = children[index];        
        const h = child.getBoundingClientRect().height;        
        acc -= h;
        if(acc <= delta) {
          return {
            index: index + this.state.range.start,
            positionOffset:delta-acc,
            offsetType: from
          }
        }
      }

      return {
        index: this.state.range.end,
        positionOffset: 0,
        offsetType: from
      }
    }    
  }

  componentDidUpdate(prevProps:VirtuallyListProps, prevState:VirtuallyListState) {
    
    if(this.props.startIndex != prevProps.startIndex || this.props.endIndex != prevProps.endIndex) {
      let firstItem = this._getFirstIndexInView(OffsetType.fromTop);
      this._jumpToIndex(firstItem);
    }

    const rangeChanged = !this._rangesEqual(prevState.range,this.state.range);
    let size = this._getContentSize()
    if(rangeChanged) {
      this._averager.addSample(this.state.range, size);
      this._updateTotalContentSize(size, this.state.offset);
    }

    // Flip from bottom offsets to top offsets.
    if(this.state.offsetType == OffsetType.fromBottom && prevState.offsetType == OffsetType.fromTop) {      
      this.setState({        
        offset: this.state.offset - size,
        offsetType: OffsetType.fromTop
      })
    }

    if(this.props.jumpToIndex != null) {
      let shouldJumpToIndex = this.props.jumpToIndex !== prevProps.jumpToIndex;      
      if(shouldJumpToIndex) {     
        this._jumpToIndex({
          index : this.props.jumpToIndex,
          offsetType: OffsetType.fromTop,
          positionOffset: 0
        });
      }
    }      
  }

  private _updateTotalContentSize(renderedContentSize: number, top:number) {
    const renderedRange = this.state.range;    
    let totalSize = 0;

    // if (renderedRange.end === this._getDataLength()) {
    //   this._averager.reset();
    // }

    // TODO: This causes a gap sometimes? 
    // https://github.com/angular/material2/pull/11195
    //if(false) {
    if(renderedRange.end == this.props.endIndex) {
      if(renderedRange.start == 0) {
        totalSize = renderedContentSize;
      } else {
        totalSize = top + renderedContentSize + ((this._getDataLength() - renderedRange.end) * this._averager.getAverageItemSize())
      }
    } else {  
      totalSize = renderedContentSize +
      (this._getDataLength() - 1 - (renderedRange.end - renderedRange.start)) *
        this._averager.getAverageItemSize();
    } 
    
    if(totalSize !== this.state.totalContentSize) {      
      this.setState({
        totalContentSize: totalSize
      })
    }    
  }

  private _onScroll(_:React.UIEvent<HTMLElement>) {
    if(this.props.onUserScrolled) {
      let container = this._scrollContainer.current;
      if(!container) return;
      this.props.onUserScrolled(container.scrollTop);
    }
    this._updateRenderedContentAfterScroll();
  }
  
  render() {
    
    let rangeLength = this.state.range.end - this.state.range.start;
    let indicesToRender = rangeLength <= 0 ? [] : Array(rangeLength).fill(0).map((_:any,index:number) => {
      return index+this.state.range.start;
    });        
    return (
        <div
          ref={this._scrollContainer}
          style={{                     
            overflowY: "auto",
            position: "relative",
            contain: "strict",
            transform: "translateZ(0)",
            willChange: "scroll-position",
            width: "100%",
            height: "100%",
            overflowAnchor : "none",
            WebkitOverflowScrolling: "touch",            
          }}
          onScroll={this._onScroll.bind(this)}
        >   
            <div ref={this._renderedItems} style={{
              contain: "content",
              position: "absolute",
              width: "100%",              
              top:0,
              left: 0,
              transform: "translateY("+(this.state.offset)+"px)" + ((this.state.offsetType == OffsetType.fromBottom) ? " translateY(-100%)" : "")              
                }}>
                {indicesToRender.map((i:number,_:number) => {
                  return this.props.itemRendererFactory(i);
                })}                  
            </div>

            <div style={{
              width: "1px",
              height: "1px",
              position: "absolute",
              top: 0, left: 0,
              transformOrigin: "0 0",
              transform: `scaleY(${this.state.totalContentSize})`
            }}/>                                    
        </div>
    );
  }
}

export default VirtuallyList;
