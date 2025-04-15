interface Props {
  text: string;
  suggestionId: string;
  style?: React.CSSProperties;
  className?: string;
};

export const suggestionIdAttribute = "data-suggestionid";

export default function Suggestion({ text, suggestionId, style, className }: Props) {
  const propFromVariable = { [suggestionIdAttribute]: suggestionId }; // dynamic prop from variable name
  return (
    <span
      className={className || "suggestion"}
      style={style}
      suppressContentEditableWarning={true}
      contentEditable="false"
      {...propFromVariable}
    >
      {text}
    </span>
  );
}