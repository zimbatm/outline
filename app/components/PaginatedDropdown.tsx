import * as React from "react";
import { useTranslation } from "react-i18next";
import { useMenuState, MenuButton } from "reakit/Menu";
import styled from "styled-components";
import User from "~/models/User";
import Button, { Inner } from "~/components/Button";
import ContextMenu from "~/components/ContextMenu";
import MenuItem from "~/components/ContextMenu/MenuItem";
import Text from "~/components/Text";
import InputSearch from "./InputSearch";
import PaginatedList from "./PaginatedList";

type TFilterOption = {
  key: string;
  label: string;
  note?: string;
};

type Props = {
  users: any;
  activeKey: string | null | undefined;
  defaultLabel?: string;
  selectedPrefix?: string;
  className?: string;
  onSelect: (key: string | null | undefined) => void;
};

const PaginatedDropdown = ({
  users,
  activeKey = "",
  defaultLabel = "Filter options",
  selectedPrefix = "",
  className,
  onSelect,
}: Props) => {
  const { t } = useTranslation();
  const menu = useMenuState({
    modal: true,
  });
  const options = React.useMemo(() => {
    const userOptions = users.all.map((user: User) => ({
      key: user.id,
      label: user.name,
    }));
    return [
      {
        key: "",
        label: t("Any author"),
      },
      ...userOptions,
    ];
  }, [users, t]);

  const selected =
    options.find((option) => option.key === activeKey) || options[0];

  const selectedLabel = selected ? `${selectedPrefix} ${selected.label}` : "";

  const [filteredData, setFilteredData] = React.useState<TFilterOption[]>([]);

  // Simple case-insensitive filter to
  // check if text appears in any author's name.
  const handleFilter = React.useCallback(
    (event) => {
      const { value } = event.target;
      if (value) {
        const filteredData = options.filter((user) =>
          user.label.toLowerCase().includes(value.toLowerCase())
        );
        setFilteredData(filteredData);
      }
    },
    [options]
  );

  // Setting `filteredData` on component mount.
  // `selectedLabel` as dependency will make sure
  // user sees a full list on clicking menu,
  // otherwise they may see partially filtered results
  // from previous query.
  React.useEffect(() => {
    setFilteredData(options);
  }, [options, selectedLabel]);

  const handleOnFocus = () => {};

  return (
    <Wrapper>
      <MenuButton {...menu}>
        {(props) => (
          <StyledButton {...props} className={className} neutral disclosure>
            {activeKey ? selectedLabel : defaultLabel}
          </StyledButton>
        )}
      </MenuButton>
      <ContextMenu aria-label={defaultLabel} {...menu}>
        <StyledInputSearch onChange={handleFilter} onFocus={handleOnFocus} />
        <br />
        {/* A bit hacky but this creates just enough space for search box.
            Now absolute position works without first element getting stuck behind it.
          */}
        <PaginatedList
          items={filteredData}
          fetch={users.fetchPage}
          renderItem={(user: TFilterOption) => (
            <MenuItem
              key={user.key}
              onClick={() => {
                onSelect(user.key);
                menu.hide();
              }}
              selected={user.key === activeKey}
              {...menu}
            >
              {user.note ? (
                <LabelWithNote>
                  {user.label}
                  <Note>{user.note}</Note>
                </LabelWithNote>
              ) : (
                user.label
              )}
            </MenuItem>
          )}
        />
      </ContextMenu>
    </Wrapper>
  );
};

const Note = styled(Text)`
  margin-top: 2px;
  margin-bottom: 0;
  line-height: 1.2em;
  font-size: 14px;
  font-weight: 400;
  color: ${(props) => props.theme.textTertiary};
`;

const LabelWithNote = styled.div`
  font-weight: 500;
  text-align: left;

  &:hover ${Note} {
    color: ${(props) => props.theme.white50};
  }
`;

const StyledButton = styled(Button)`
  box-shadow: none;
  text-transform: none;
  border-color: transparent;
  height: auto;

  &:hover {
    background: transparent;
  }

  ${Inner} {
    line-height: 24px;
    min-height: auto;
  }
`;

// `position: sticky` leaves a bit of space above the search box,
// which shows author names moving past behind it.
const StyledInputSearch = styled(InputSearch)`
  position: absolute;
  top: 0;
  z-index: 1;
`;

const Wrapper = styled.div`
  margin-right: 8px;
`;

export default PaginatedDropdown;