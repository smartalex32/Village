import { type ImperativeRouter, useRouter } from "expo-router";

function blurFocusedElement() {
  if (typeof document === "undefined") return;

  const focusedElement = document.activeElement;
  if (
    typeof HTMLElement !== "undefined" &&
    focusedElement instanceof HTMLElement
  ) {
    focusedElement.blur();
  }
}

/**
 * Blurs the web control that initiated navigation before Expo Router hides its
 * previous screen from assistive technology.
 */
export function useAppRouter(): ImperativeRouter {
  const router = useRouter();

  return {
    ...router,
    back: () => {
      blurFocusedElement();
      router.back();
    },
    push: (href, options) => {
      blurFocusedElement();
      router.push(href, options);
    },
    navigate: (href, options) => {
      blurFocusedElement();
      router.navigate(href, options);
    },
    replace: (href, options) => {
      blurFocusedElement();
      router.replace(href, options);
    },
    dismiss: (count) => {
      blurFocusedElement();
      router.dismiss(count);
    },
    dismissTo: (href, options) => {
      blurFocusedElement();
      router.dismissTo(href, options);
    },
    dismissAll: () => {
      blurFocusedElement();
      router.dismissAll();
    },
  };
}
