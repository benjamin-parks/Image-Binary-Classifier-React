export default function Button({title, size, buttonName}){
    if (size === "3"){
        return (
                <button className="btn btn-success col-3" id={buttonName + "Button"}>{title}</button>
        )
    }
    else{
        return (
                <button className="btn btn-primary col-1 me-2" id={buttonName + "Button"}>{title}</button>        )
    }
    
}