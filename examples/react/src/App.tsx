import './App.css'
import { FixedSizeList as List, ListChildComponentProps } from 'react-window';

const Row = ({ index, style }: ListChildComponentProps) => (
  <div className={index % 2 ? 'ListItemOdd' : 'ListItemEven'} style={style}>
    Row {index}
  </div>
);

function App() {
  return (
    <div className="App">
      <List
        className="List"
        height={700}
        itemCount={1000}
        itemSize={35}
        width={400}
      >
        {Row}
      </List>
    </div >
  )
}

export default App
