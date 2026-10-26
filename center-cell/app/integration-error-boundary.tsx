'use client';
import {Component,type ReactNode} from 'react';

type Props={children:ReactNode;label:string};
type State={failed:boolean};

export default class IntegrationErrorBoundary extends Component<Props,State>{
  state:State={failed:false};

  static getDerivedStateFromError():State{return {failed:true}}

  componentDidCatch(error:Error){console.error('Falha no painel de integração:',this.props.label,error)}

  render(){
    if(this.state.failed)return <div className="ix-error" role="alert">
      <strong>Não foi possível abrir {this.props.label}.</strong>
      <p>As demais configurações continuam disponíveis. Tente carregar este painel novamente.</p>
      <button type="button" onClick={()=>this.setState({failed:false})}>Tentar novamente</button>
    </div>;
    return this.props.children;
  }
}
