const YANDEX_API_KEY = "";

const WIDGET_BASE_CONFIG = {
  lang: "rus",
  currency: "RUB",
  /*
  Скрыты все фильтры, для того чтобы скрыть иконку фильтров, надо добавить в CSS обертывающего блока -  
  .widgetContainer :global(.ymaps3--control__background):has(h1 + div:empty) {
    display: none;
  }
  */
  hideFilters: {
    have_cashless: true,
    have_cash: true,
    is_dressing_room: true,
    type: true,
  },
  tariffs: {
    // Коды тарифов (выбраны склад-склад)
    office: [136, 234],
  },
  // параметры посылки по умолчанию
  // для изменения параметров
  // window.__cdekInstance
  // .getParcels()
  // .addParcel()
  // .resetParcels({ width: 25, height: 1, length: 35, weight: 1000 })
  goods: [{ width: 25, height: 1, length: 35, weight: 1000 }],
  hideDeliveryOptions: {
    door: true,
    office: false,
  },
  debug: false,
};

// Откуда идут посылки для рассчета тарифов
const fromLocation = {
  city: "Пушкино",
  cityCode: "17",
};

const slotRef = useRef(null);

const blockSample = 
(
  <div ref={slotRef} className={styles.widgetContainer} />,
);

// Init script in block
useEffect(() => {
  if (!show) return;
  if (!slotRef.current) return;

  const { address, regionCode } = resolveLocation();
  if (regionCode == null) {
    throw new Error("CdekPvzPicker: regionCode is required");
  }

  let cancelled = false;
  waitForCdekScript()
    .then(() => {
      if (cancelled || !slotRef.current) return;
      ensureCdekWidget({
        target: slotRef.current,
        from: {
          country_code: "RU",
          city: fromLocation.city,
          code: fromLocation.cityCode,
        },
        apiKey: YANDEX_API_KEY,
        address,
        regionCode,
        baseConfig: WIDGET_BASE_CONFIG,
      });
      setCdekOnChoose((_type, _tariff, addr) => {
        if (addr?.code) {
          onChangeRef.current(addr.code);

          // Result address
          setSelectedAddress(
            [addr.city, addr.address].filter(Boolean).join(", "),
          );
        }
        setShow(false);
      });
    })
    .catch((err) => {
      console.error("Ошибка инициализации виджета СДЭК", err);
    });

  return () => {
    cancelled = true;
    detachCdekWidget();
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [show]);

// update userLocation to trigger map change
useEffect(() => {
  if (!show) return;
  const { address, regionCode } = userLocation;
  if (regionCode == null) return;
  updateCdekLocation({ address, regionCode });
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [userLocation, show]);
