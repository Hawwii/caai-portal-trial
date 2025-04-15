import { Popper, PopperPlacementType } from '@mui/base/Popper';

export default function TutorialPopup({ popupText, anchorEl }: {
  popupText: string;
  anchorEl: Element | null;
}) {
  if (!anchorEl) return null;

  return (
    <Popper open={Boolean(anchorEl)} anchorEl={anchorEl} placement="bottom-start">
      <div className="bg-white border-2 border-blue-500 p-2 rounded-lg shadow-lg max-w-sm top-2 mt-2">
        <p>{popupText}</p>
      </div>
    </Popper>
  )
};