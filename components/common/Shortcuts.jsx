import DialogContent from '@material-ui/core/DialogContent';
import closeIcon from '../../public/static/svgImages/Close.svg';
import SVGInline from 'react-svg-inline';

const Shortcuts = ({ showShortcut, setShowShortcut }) => {
    return (
        <>
            {showShortcut && <DialogContent onClick={() => {
                setShowShortcut(false)
            }} className='modal-container__content_'>
                <div className='content'>
                    <table tabIndex={0} className='table-wrapper'>
                        <thead className='table-header'>
                            <tr className='heading-wrapper'>
                                <td colSpan={2}>
                                    <h1>Shortcuts</h1>
                                </td>
                                <td className='close-td'>
                                    <SVGInline
                                        className="toggler-icon"
                                        classSuffix=""
                                        svg={closeIcon}
                                        onClick={() => {
                                            setShowShortcut(false);
                                        }}
                                    />
                                </td>

                            </tr>
                            <tr>
                                <th>
                                    Keyboard shortcut <br />
                                    Windows (Apple)
                                </th>
                                <th>
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody className='table-body'>
                            <tr>
                                <td> ctrl+s (command+s)  </td>
                                <td>Save</td>
                            </tr>
                            <tr>
                                <td> ctrl+z (command+z) </td>
                                <td>Undo</td>

                            </tr>
                            <tr>
                                <td> ctrl+y (command+y)  </td>
                                <td>Redo</td>
                            </tr>
                            <tr>
                                <td>  ctrl+c (command+c) </td>
                                <td>Copy</td>
                            </tr>
                            <tr>
                                <td>ctrl+v (command+v) </td>
                                <td>Paste</td>
                            </tr>
                            <tr>
                                <td>Delete (Delete) </td>
                                <td>Delete Item</td>
                            </tr>
                            <tr>
                                <td>ctrl+d (command+d) </td>
                                <td>Create active item in new layer</td>
                            </tr>
                            <tr>
                                <td>ctrl+o (command+o) </td>
                                <td>Create Combined Items</td>
                            </tr>
                            <tr>
                                <td>ctrl+p (command+p) </td>
                                <td>Delete Combined Items</td>
                            </tr>
                        </tbody>
                    </table>
                </div>

            </DialogContent>}</>
    )
}
export default Shortcuts;