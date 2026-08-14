import type { JSX, Component } from 'solid-js';

type Props = {
  children: JSX.Element;
};

const ReplyBox: Component<Props> = (props) => (
  <div class="bg-gray-50 border border-gray-200 rounded-xl py-3.5 px-4">
    {props.children}
  </div>
);

export default ReplyBox;
