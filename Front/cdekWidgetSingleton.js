const PARKING_ID = "cdek-widget-parking";
const CONTAINER_ID = "cdek-pvz-map-singleton";

let instance = null;
let widgetParams = null;
let containerEl = null;
let parkingEl = null;
let currentOnChoose = null;
let currentLocation = null;
const ensureParking = () => {
  if (parkingEl && parkingEl.isConnected) return parkingEl;
  parkingEl = document.createElement("div");
  parkingEl.id = PARKING_ID;
  parkingEl.style.cssText =
    "position:absolute;left:-99999px;top:0;width:1000px;height:700px;overflow:hidden;pointer-events:none;";
  document.body.appendChild(parkingEl);
  return parkingEl;
};

const ensureContainer = () => {
  if (containerEl && containerEl.isConnected) return containerEl;
  containerEl = document.createElement("div");
  containerEl.id = CONTAINER_ID;
  containerEl.style.cssText = "width:100%;height:100%;";
  ensureParking().appendChild(containerEl);
  return containerEl;
};

export const waitForCdekScript = (timeoutMs = 8000) =>
  new Promise((resolve, reject) => {
    if (window.CDEKWidget) return resolve();
    const start = Date.now();
    const tick = () => {
      if (window.CDEKWidget) return resolve();
      if (Date.now() - start > timeoutMs) {
        return reject(new Error("CDEK widget script не загружен"));
      }
      setTimeout(tick, 50);
    };
    tick();
  });

export const ensureCdekWidget = ({
  target,
  from,
  apiKey,
  address,
  regionCode,
  baseConfig,
}) => {
  ensureContainer();
  if (target) attachCdekWidget(target);
  if (instance) return instance;
  if (!window.CDEKWidget) {
    throw new Error("CDEK widget script не загружен");
  }
  widgetParams = {
    ...baseConfig,
    from,
    root: CONTAINER_ID,
    apiKey,
    servicePath: `/api/cdek-widget?region_code=${regionCode}`,
    defaultLocation: address,
    onChoose: (...args) => {
      currentOnChoose?.(...args);
    },
  };
  instance = new window.CDEKWidget(widgetParams);
  window.__cdekInstance = instance;
  currentLocation = { address, regionCode };
  return instance;
};

export const setCdekOnChoose = (onChoose) => {
  currentOnChoose = onChoose;
};

export const attachCdekWidget = (target) => {
  ensureContainer();
  if (target && containerEl.parentElement !== target) {
    target.appendChild(containerEl);
  }
};

export const detachCdekWidget = () => {
  ensureParking();
  if (containerEl && containerEl.parentElement !== parkingEl) {
    parkingEl.appendChild(containerEl);
  }
  currentOnChoose = null;
};

function isCancel(value) {
  return !!(value && value.__CANCEL__);
}

export const updateCdekLocation = ({ address, regionCode }) => {
  if (!instance) return false;
  if (
    currentLocation &&
    currentLocation.address === address &&
    currentLocation.regionCode === regionCode
  ) {
    return false;
  }
  const servicePath = `/api/cdek-widget?region_code=${regionCode}`;
  try {
    instance.clearSelection?.();
    instance.params.servicePath = servicePath;
    instance.params.defaultLocation = address;
    instance.cdekApi.servicePath = servicePath;
    const additionalParams = {};
    if (widgetParams.sender) {
      additionalParams.is_handout_only = false;
      additionalParams.is_reception = true;
    } else {
      additionalParams.is_handout = true;
    }
    // Без этого при поиске перестает работать выбор региона.
    instance.cdekApi.getOfficesAbort = null;
    instance.cdekApi
      .fetchOfficePage(additionalParams, 0, 500)
      .then((r) => {
        const totalElements = parseInt(r.headers.get("x-total-elements"));
        const firstPageData = r.data;

        console.log(r.data);
        // Если заголовка нет или элементов мало — возвращаем только первую страницу
        if (isNaN(totalElements) || totalElements <= 500) {
          return [firstPageData];
        }

        const totalPages = Math.ceil(totalElements / 500);

        // Создаем массив промисов для ОСТАЛЬНЫХ страниц (начиная с индекса 1)
        const otherPagesPromises = Array.from(
          { length: totalPages - 1 },
          (_, i) =>
            instance.cdekApi
              .fetchOfficePage(additionalParams, i + 1, 500)
              .then((r2) => r2.data),
        );

        // Соединяем данные первой страницы с остальными
        return Promise.all(otherPagesPromises).then((otherPagesData) => [
          firstPageData,
          ...otherPagesData,
        ]);
      })
      .then((o) =>
        o.map((r) => (typeof r === "string" ? JSON.parse(r) : r)).flat(),
      )
      .catch((e) => {
        if (isCancel(e)) {
          console.debug("[CDEK] Offices request cancelled");
          throw e;
        }

        console.error("[CDEK] Service error", e);
        throw e;
        // TODO : find how to pass YandexMapErrorCode
        // map().mapLoadError = YandexMapErrorCode.SERVICE_ERROR;
        // return [];
      })
      .then((o) => {
        instance.updateOfficesRaw(o);
        instance.updateLocation?.(address);
      });

    currentLocation = { address, regionCode };
    return true;
  } catch (err) {
    console.error("Ошибка обновления виджета СДЭК", err);
    return false;
  }
};

export const getCdekCurrentLocation = () => currentLocation;
