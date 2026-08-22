import Config from "./Config/Config.js";
import SyAPP from "../SyAPP.js";
import SyDB from "../SyDB.js";

class SyInstances {
  static Model = SyDB.Model('SyInstances', {
    Name: { required: true, type: 'string', default: 'Draft' },
    Main: { required: true, type: 'boolean', default: true },
    OwnerID: { required: false, type: 'string' },
    Type: { required: false },
    Running: { required: true, type: 'boolean', default: true },
    Status: { required: true, type: 'string', default: 'Online' }
  });
}

class Sy extends SyAPP.Func() {
  constructor() {
    super(
      'sy',
      async (props) => {
        const uid = props.session.UniqueID;
        const page = props.page || '';

        const instances = await SyInstances.Model.find();

        // ---------- PERSISTENT STATE HELPERS ----------
        const getManageState = () => {
          const state = this.Storages.Get(uid, 'manage_state');
          return state || { action: null, confirmDeleteId: null };
        };

        const setManageState = (updates) => {
          const current = getManageState();
          const newState = { ...current, ...updates };
          this.Storages.Set(uid, 'manage_state', newState);
          return newState;
        };

        // ---------- CREATE NEW INSTANCE ----------
        if (props.new_instance) {
          await SyInstances.Model.create({
            Name: 'Draft',
            Main: props.parent_id ? false : true,
            OwnerID: props.parent_id || null,
            Type: props.parent_id ? 'child' : 'app',
            Running: true,
            Status: 'Online'
          });
        }

        // ---------- DELETE INSTANCE (AFTER CONFIRMATION) ----------
        if (props.do_delete) {
          const all = await SyInstances.Model.find();
          const removeRecursive = async (id) => {
            for (const child of all.filter(i => i.OwnerID === id)) {
              await removeRecursive(child._id);
            }
            await SyInstances.Model.delete(id);
          };
          await removeRecursive(props.do_delete);
          setManageState({ action: null, confirmDeleteId: null });
        }

        // ---------- EDIT NAME ----------
        if (props.edit_name) {
          if (props.inputValue) {
            await SyInstances.Model.update(props.edit_name, { Name: props.inputValue.trim() });
            setManageState({ action: null, confirmDeleteId: null });
          } else {
            this.WaitInput(uid, { question: 'New name:', props: { edit_name: props.edit_name, page: 'manage' } });
          }
        }

        // ---------- MANAGE ACTION HANDLERS ----------
        if (props.manage_action === 'edit') {
          setManageState({ action: 'edit', confirmDeleteId: null });
        }

        if (props.manage_action === 'delete') {
          setManageState({ action: 'delete', confirmDeleteId: null });
        }

        if (props.manage_action === 'back') {
          setManageState({ action: null, confirmDeleteId: null });
        }

        if (props.confirm_delete) {
          setManageState({ action: 'delete', confirmDeleteId: props.confirm_delete });
        }

        // ---------- HELPERS ----------
        const isDropdownOpen = (key) => {
          const state = this.Storages.Get(uid, `dropdown-${key}`);
          return state && state.dropped === true;
        };

        const getVisibleInstances = (allInstances) => {
          const visible = [];
          const mains = allInstances.filter(i => i.Main === true);

          // Find which main is open (only one main layer can be open)
          let openMain = null;
          for (const main of mains) {
            if (isDropdownOpen(`inst-${main._id}`)) {
              openMain = main;
              break;
            }
          }

          const traverse = (instance, depth, parentOpen) => {
            if (!parentOpen) return;
            visible.push({ instance, depth });
            const ownOpen = isDropdownOpen(`inst-${instance._id}`);
            const children = allInstances.filter(i => i.OwnerID === instance._id);
            for (const child of children) {
              traverse(child, depth + 1, ownOpen);
            }
          };

          // Only traverse children of the open main
          if (openMain) {
            const children = allInstances.filter(i => i.OwnerID === openMain._id);
            for (const child of children) {
              traverse(child, 1, true);
            }
          }

          return visible;
        };

        // ---------- CLOSE OTHER MAIN DROPDOWNS ----------
        const closeOtherMainDropdowns = (currentMainId) => {
          const mains = instances.filter(i => i.Main === true);
          for (const main of mains) {
            if (main._id !== currentMainId) {
              const key = `dropdown-inst-${main._id}`;
              const state = this.Storages.Get(uid, key);
              if (state && state.dropped) {
                state.dropped = false;
                this.Storages.Set(uid, key, state);
              }
            }
          }
        };

        // ---------- CLOSE ALL CHILD DROPDOWNS OF A PARENT ----------
        const closeChildDropdowns = (parentId) => {
          const descendants = [];
          const collectDescendants = (id) => {
            for (const inst of instances) {
              if (inst.OwnerID === id) {
                descendants.push(inst._id);
                collectDescendants(inst._id);
              }
            }
          };
          collectDescendants(parentId);
          for (const descId of descendants) {
            const key = `dropdown-inst-${descId}`;
            const state = this.Storages.Get(uid, key);
            if (state && state.dropped) {
              state.dropped = false;
              this.Storages.Set(uid, key, state);
            }
          }
        };

        // ---------- RENDER INSTANCE TREE (CLEAN) ----------
        const renderInstance = async (instance, depth = 0, isMain = false) => {
          const children = instances.filter(i => i.OwnerID === instance._id);
          const key = `inst-${instance._id}`;
          const count = children.length ? ` (${children.length})` : '';
          const prefix = isMain ? '🟢 ' : '    '.repeat(depth) + '└─ ';

          // Capture state before DropDown for main close detection
          const stateBefore = this.Storages.Get(uid, `dropdown-${key}`);
          const wasOpenBefore = stateBefore?.dropped === true;
          const wasClicked = props.droprun === `dropdown-${key}`;

          // If this is a main instance and was clicked to open, close other main dropdowns
          if (isMain && wasClicked) {
            const currentState = this.Storages.Get(uid, `dropdown-${key}`);
            if (currentState && !currentState.dropped) {
              closeOtherMainDropdowns(instance._id);
            }
          }

          await this.DropDown(uid, key, async () => {
            // Calculate indentation for buttons based on depth
            const buttonIndent = '  '.repeat(depth + 1);
            
            // Group Add Child and Manage buttons horizontally with extra indentation
            this.Buttons(uid, [
              {
                name: this.TextColor.orange(`${buttonIndent}＋ Add Child`),
                props: { new_instance: true, parent_id: instance._id, page }
              },
              {
                name: this.TextColor.orange(`${buttonIndent}⚙️ Manage`),
                props: { page: 'manage' }
              }
            ]);

            // Recursively render children
            for (const child of children) {
              await renderInstance(child, depth + 1, false);
            }
          }, {
            up_buttontext: `${prefix}📁 ${instance.Name}${count}`,
            down_buttontext: `${prefix}📂 ${instance.Name}${count}`,
            jumpTo: 0
          });

          // After DropDown, check if main was open and now closed -> close children
          const stateAfter = this.Storages.Get(uid, `dropdown-${key}`);
          const isNowClosed = stateAfter?.dropped === false;
          if (isMain && wasOpenBefore && isNowClosed) {
            closeChildDropdowns(instance._id);
          }
        };

        // ---------- RENDER MAIN PAGE ----------
        await this.Page(uid, '', async () => {
          const mains = instances.filter(i => i.Main === true);
          for (const main of mains) {
            await renderInstance(main, 0, true);
          }

          this.Button(uid, ' ');
          this.Button(uid, {
            name: this.TextColor.orange('＋ New Main'),
            props: { new_instance: true, page }
          });

          this.Button(uid, ' ');
          this.SideButton(uid, { name: '⚙️ Config', path: 'config' });
        });

        // ---------- RENDER MANAGE PAGE ----------
        await this.Page(uid, 'manage', async () => {
          const manageState = getManageState();
          const visible = getVisibleInstances(instances);

          // CONFIRMATION VIEW
          if (manageState.confirmDeleteId) {
            const target = instances.find(i => i._id === manageState.confirmDeleteId);
            const targetName = target ? target.Name : 'Unknown';
            this.Text(uid, `Delete "${targetName}"?`);
            this.Buttons(uid, [
              { name: '✅ Yes, Delete', props: { do_delete: manageState.confirmDeleteId, page: 'manage' } },
              { name: '❌ Cancel', props: { manage_action: 'back', page: 'manage' } }
            ]);
          }
          // EDIT NAME VIEW
          else if (manageState.action === 'edit') {
            if (visible.length === 0) {
              this.Text(uid, 'No visible child instances.');
            } else {
              for (const { instance, depth } of visible) {
                const indent = '　'.repeat(depth);
                this.Button(uid, {
                  name: `${indent}${instance.Name}`,
                  props: { edit_name: instance._id, page: 'manage' }
                });
              }
            }
            this.Button(uid, ' ');
            this.Button(uid, {
              name: '↩ Back',
              props: { manage_action: 'back', page: 'manage' }
            });
          }
          // DELETE VIEW
          else if (manageState.action === 'delete') {
            if (visible.length === 0) {
              this.Text(uid, 'No visible child instances.');
            } else {
              for (const { instance, depth } of visible) {
                const indent = '　'.repeat(depth);
                this.Button(uid, {
                  name: `${indent}${instance.Name}`,
                  props: { confirm_delete: instance._id, page: 'manage' }
                });
              }
            }
            this.Button(uid, ' ');
            this.Button(uid, {
              name: '↩ Back',
              props: { manage_action: 'back', page: 'manage' }
            });
          }
          // DEFAULT: ACTION SELECTION
          else {
            this.Buttons(uid, [
              { name: '✏️ Edit Name', props: { manage_action: 'edit', page: 'manage' } },
              { name: '🗑️ Delete', props: { manage_action: 'delete', page: 'manage' } }
            ]);
          }

          // Back to main instances page
          this.Button(uid, ' ');
          this.Button(uid, {
            name: '↩ Back to Instances',
            props: { page: '' }
          });
        });
      },
      { linked: [Config] }
    );
  }
}

export default Sy;