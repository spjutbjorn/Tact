export namespace backend {
	
	export class TerminalProfile {
	    id: string;
	    name: string;
	    model: string;
	    command: string;
	    installCommand: string;
	    description: string;
	
	    static createFrom(source: any = {}) {
	        return new TerminalProfile(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.name = source["name"];
	        this.model = source["model"];
	        this.command = source["command"];
	        this.installCommand = source["installCommand"];
	        this.description = source["description"];
	    }
	}

}

export namespace main {
	
	export class FileEntry {
	    name: string;
	    isDir: boolean;
	    size: number;
	
	    static createFrom(source: any = {}) {
	        return new FileEntry(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.name = source["name"];
	        this.isDir = source["isDir"];
	        this.size = source["size"];
	    }
	}
	export class GitFileStatus {
	    path: string;
	    status: string;
	
	    static createFrom(source: any = {}) {
	        return new GitFileStatus(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.status = source["status"];
	    }
	}
	export class TerminalSessionInfo {
	    id: string;
	    profileId: string;
	    name: string;
	    model: string;
	    command: string;
	    running: boolean;
	    startedAt: string;
	
	    static createFrom(source: any = {}) {
	        return new TerminalSessionInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.id = source["id"];
	        this.profileId = source["profileId"];
	        this.name = source["name"];
	        this.model = source["model"];
	        this.command = source["command"];
	        this.running = source["running"];
	        this.startedAt = source["startedAt"];
	    }
	}
	export class VolumeInfo {
	    path: string;
	    name: string;
	
	    static createFrom(source: any = {}) {
	        return new VolumeInfo(source);
	    }
	
	    constructor(source: any = {}) {
	        if ('string' === typeof source) source = JSON.parse(source);
	        this.path = source["path"];
	        this.name = source["name"];
	    }
	}

}

